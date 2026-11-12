import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Props } from '../../app/routes';
import { useReducedMotion } from '../../core/accessibility';
import { ApiError } from '../../core/api';
import { useApp } from '../../core/app-context';
import { PickedDocument, pickDocuments } from '../../core/documents';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { formatInstant } from '../../core/time';
import {
  Button,
  Card,
  ErrorBox,
  Field,
  RemoteState,
  Row,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { ChatBubble, ChatHeader, ChatIcon, ChatText, chatColors } from './chat-ui';
import { ChatComposer } from './composer';
import { Conversation, chatImageTypes, parseAnswer, parseThread, validChatImages } from './models';
import { AssistantRepository } from './repository';

type Exchange = ReturnType<typeof parseAnswer> & {
  question: string;
  before?: ReturnType<typeof parseThread> | null;
};

function assistantError(error: unknown) {
  if (!(error instanceof ApiError)) return undefined;
  if (error.code === 8200) return 'assistantErrorMissing';
  if (error.code === 8202) return 'assistantErrorArchived';
  if (error.code === 8102) return 'assistantErrorPromptLength';
  if (error.code >= 8104 && error.code <= 8110 && error.code !== 8108)
    return 'assistantInvalidImages';
}

export function AssistantScreen({ navigation }: Props<'Assistant'>) {
  const { api, t, locale } = useApp();
  const reducedMotion = useReducedMotion();
  const repo = useMemo(() => new AssistantRepository(api), [api]);
  const [id, setId] = useState<string>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<PickedDocument[]>([]);
  const [edit, setEdit] = useState<{ id: string; title: string }>();
  const [notice, setNotice] = useState('');
  const [exchange, setExchange] = useState<Exchange>();
  const [sending, setSending] = useState(false);
  const [reconciled, setReconciled] = useState(false);
  const [interaction, setInteraction] = useState(false);
  const [fileError, setFileError] = useState('');
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const quota = useRemote(useCallback(() => repo.quota(), [repo]));
  const history = useRemote(
    useCallback(() => (historyOpen ? repo.list() : Promise.resolve([])), [repo, historyOpen]),
  );
  const thread = useRemote(
    useCallback(() => (id ? repo.thread(id) : Promise.resolve(null)), [repo, id]),
  );
  const sendWrite = useWrite();
  const historyWrite = useWrite();
  const hasDraft = !!(prompt.trim() || images.length);
  const dirty = hasDraft || edit !== undefined;
  const locked = interaction || sending || sendWrite.busy || historyWrite.busy;
  const historyReady = !!history.data && !history.loading && !history.error;
  const canSend =
    !!quota.data &&
    !quota.loading &&
    !quota.error &&
    !!prompt.trim() &&
    prompt.trim().length <= quota.data.maxPromptLength &&
    validChatImages(images, quota.data) &&
    (!id || (!!thread.data && !thread.loading && !thread.error));
  useDirty(dirty, locked);
  useEffect(() => {
    if (!historyOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!locked) setHistoryOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [historyOpen, locked]);

  async function discardDraft() {
    if (dirty && !(await confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel'))))
      return false;
    setPrompt('');
    setImages([]);
    setEdit(undefined);
    setFileError('');
    setReconciled(false);
    sendWrite.reset();
    return true;
  }

  async function open(next?: string) {
    if (locked) return;
    if (next && next === id) {
      setHistoryOpen(false);
      return;
    }
    setInteraction(true);
    try {
      if (!(await discardDraft())) return;
      setId(next);
      setExchange(undefined);
      setHistoryOpen(false);
    } finally {
      setInteraction(false);
    }
  }

  async function pick() {
    if (!quota.data || locked || sendWrite.uncertain) return;
    Keyboard.dismiss();
    setInteraction(true);
    setFileError('');
    try {
      const selection = await pickDocuments({ type: chatImageTypes, multiple: true });
      if (selection.canceled) return;
      const next = [...images, ...selection.assets];
      if (validChatImages(next, quota.data)) setImages(next);
      else setFileError(t('assistantInvalidImages'));
    } catch {
      setFileError(t('assistantFileError'));
    } finally {
      setInteraction(false);
    }
  }

  async function send() {
    if (!canSend || locked || sendWrite.uncertain || !quota.data) return;
    const limits = quota.data;
    const question = prompt.trim();
    setSending(true);
    setFileError('');
    Keyboard.dismiss();
    try {
      await sendWrite.run(
        () => repo.send(question, id, images, limits),
        async (answer) => {
          setPrompt('');
          setImages([]);
          setExchange({ ...answer, question, before: thread.data });
          if (id) await thread.reload();
          else setId(answer.id);
        },
      );
    } finally {
      setSending(false);
    }
  }

  async function rename(conversation: Conversation) {
    if (!historyReady || !edit || !edit.title.trim() || locked || historyWrite.uncertain) return;
    await historyWrite.run(
      () => repo.rename(conversation, edit.title),
      async () => {
        setEdit(undefined);
        setNotice(t('assistantRenamed'));
        await Promise.all([history.reload(), id === conversation.id && thread.reload()]);
      },
    );
  }

  async function remove(conversation: Conversation) {
    if (!historyReady || locked || historyWrite.uncertain || (id === conversation.id && hasDraft))
      return;
    setInteraction(true);
    try {
      if (
        !(await confirm(
          t('assistantDelete'),
          t('assistantDeleteConfirm').replace('{title}', conversation.title),
          t('assistantDeleteAction'),
          t('cancel'),
        ))
      )
        return;
      await historyWrite.run(
        () => repo.remove(conversation.id),
        async () => {
          if (id === conversation.id) {
            setId(undefined);
            setExchange(undefined);
          }
          setNotice(t('assistantDeleted'));
          await history.reload();
        },
      );
    } finally {
      setInteraction(false);
    }
  }

  async function reconcileSend() {
    if (locked) return;
    if (!id) {
      setHistoryOpen(true);
      return;
    }
    setInteraction(true);
    try {
      if (await thread.reload()) setReconciled(true);
    } finally {
      setInteraction(false);
    }
  }

  async function reloadHistory() {
    const updated = await history.reload();
    if (!updated) return;
    if (historyWrite.uncertain && id && !updated.some((item) => item.id === id)) {
      setId(undefined);
      setExchange(undefined);
    }
    historyWrite.reset();
  }

  async function discardUnknownSend() {
    setInteraction(true);
    try {
      await discardDraft();
    } finally {
      setInteraction(false);
    }
  }

  const fallback =
    exchange?.id === id && (!thread.data || thread.data === exchange?.before)
      ? exchange
      : undefined;
  const showDiscard = reconciled || (!id && historyOpen && historyReady);
  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <StatusBar barStyle="light-content" />
      <ChatHeader
        history={historyOpen}
        title={thread.data?.title || fallback?.title}
        locked={locked}
        onHistory={() => {
          Keyboard.dismiss();
          setHistoryOpen(!historyOpen);
        }}
        onNew={() => open()}
        onClose={() => navigation.goBack()}
      />
      <SafeAreaView
        edges={historyOpen ? ['left', 'right', 'bottom'] : ['left', 'right']}
        style={styles.main}
      >
        <ScrollView
          key={historyOpen ? 'history' : (id ?? 'new')}
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          onContentSizeChange={() => {
            if (!historyOpen && (thread.data?.messages.length || sending || fallback))
              scroll.current?.scrollToEnd({ animated: !reducedMotion });
          }}
        >
          {historyOpen ? (
            <>
              {!!notice && (
                <Txt accessibilityLiveRegion="polite" style={styles.notice}>
                  {notice}
                </Txt>
              )}
              <ErrorBox
                error={historyWrite.error}
                messageKey={assistantError(historyWrite.error)}
              />
              {!!history.error && (
                <ErrorBox
                  error={history.error}
                  messageKey="assistantErrorHistory"
                  retry={reloadHistory}
                />
              )}
              {historyWrite.uncertain && (
                <Button
                  kind="secondary"
                  label={t('refresh')}
                  loading={history.loading}
                  onPress={reloadHistory}
                />
              )}
              <RemoteState loading={history.loading && !history.data} retry={reloadHistory}>
                {history.data?.length === 0 && <Txt muted>{t('assistantNoHistory')}</Txt>}
                {history.data?.map((item) =>
                  edit?.id === item.id ? (
                    <Card key={item.id}>
                      <Field
                        label={t('assistantConversationName')}
                        value={edit.title}
                        maxLength={120}
                        editable={!locked && !historyWrite.uncertain}
                        onChangeText={(title) => setEdit({ id: item.id, title })}
                      />
                      <Row>
                        <Button
                          label={t('cancel')}
                          kind="secondary"
                          disabled={locked}
                          onPress={() => setEdit(undefined)}
                        />
                        <Button
                          label={t('save')}
                          loading={historyWrite.busy}
                          disabled={
                            !historyReady ||
                            !edit.title.trim() ||
                            edit.title.trim() === item.title ||
                            locked ||
                            historyWrite.uncertain
                          }
                          onPress={() => rename(item)}
                        />
                      </Row>
                    </Card>
                  ) : (
                    <View
                      key={item.id}
                      style={[styles.historyRow, item.id === id && styles.activeHistoryRow]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: item.id === id, disabled: locked }}
                        disabled={locked}
                        onPress={() => open(item.id)}
                        style={styles.historyItem}
                      >
                        <Txt numberOfLines={2} style={styles.historyTitle}>
                          {item.title}
                        </Txt>
                        {!!item.updatedAt && (
                          <Txt muted style={styles.updatedAt}>
                            {t('assistantUpdatedAt').replace(
                              '{time}',
                              formatInstant(item.updatedAt, locale),
                            )}
                          </Txt>
                        )}
                      </Pressable>
                      <ChatIcon
                        name="edit-3"
                        label={t('assistantRename') + ' ' + item.title}
                        disabled={!historyReady || locked || historyWrite.uncertain || !!edit}
                        onPress={() => setEdit({ id: item.id, title: item.title })}
                      />
                      <ChatIcon
                        name="trash-2"
                        label={t('assistantDelete') + ' ' + item.title}
                        disabled={
                          !historyReady ||
                          locked ||
                          historyWrite.uncertain ||
                          !!edit ||
                          (item.id === id && hasDraft)
                        }
                        onPress={() => remove(item)}
                      />
                    </View>
                  ),
                )}
              </RemoteState>
            </>
          ) : (
            <>
              <ChatBubble>
                <ChatText content={t('assistantGreeting')} plain />
              </ChatBubble>
              {!!id && (
                <RemoteState
                  loading={thread.loading && !thread.data && !fallback}
                  retry={thread.reload}
                >
                  {!!thread.error && (
                    <ErrorBox
                      error={thread.error}
                      messageKey={assistantError(thread.error) ?? 'assistantErrorConversation'}
                      retry={thread.reload}
                    />
                  )}
                  {thread.data?.messages.map((message) => {
                    const mine = message.role === 'USER';
                    return (
                      <ChatBubble key={message.id} mine={mine}>
                        {!!message.content && <ChatText content={message.content} mine={mine} />}
                        {message.images.map((image) => (
                          <Button
                            key={image.id}
                            label={image.name || t('assistantImage')}
                            kind="secondary"
                            disabled={!image.url}
                            icon="image"
                            onPress={() =>
                              Linking.openURL(image.url).catch(() =>
                                setFileError(t('assistantFileError')),
                              )
                            }
                          />
                        ))}
                      </ChatBubble>
                    );
                  })}
                </RemoteState>
              )}
              {fallback && (
                <>
                  <ChatBubble mine>
                    <ChatText content={fallback.question} mine />
                  </ChatBubble>
                  <ChatBubble>
                    <ChatText content={fallback.answer} />
                  </ChatBubble>
                </>
              )}
              {sending && !fallback && (
                <>
                  {!!prompt.trim() && (
                    <ChatBubble mine>
                      <ChatText content={prompt.trim()} mine />
                    </ChatBubble>
                  )}
                  <ChatBubble>
                    <Txt accessibilityLiveRegion="polite" muted>
                      {t('assistantThinking')}
                    </Txt>
                  </ChatBubble>
                </>
              )}
              <ErrorBox error={quota.error} retry={quota.reload} />
            </>
          )}
          <ErrorBox error={sendWrite.error} messageKey={assistantError(sendWrite.error)} />
          {sendWrite.uncertain && (
            <>
              <Txt muted>{t('assistantCheckHistory')}</Txt>
              {showDiscard ? (
                <Button
                  label={t('assistantDiscardQuestion')}
                  kind="secondary"
                  disabled={locked}
                  onPress={discardUnknownSend}
                />
              ) : (
                <Button
                  label={t('requestReconcile')}
                  kind="secondary"
                  loading={interaction}
                  onPress={reconcileSend}
                />
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      {!historyOpen && (
        <ChatComposer
          prompt={prompt}
          images={images}
          quota={quota.data}
          locked={locked || sendWrite.uncertain || quota.loading || !!quota.error}
          sending={sending}
          sendDisabled={!canSend || locked || sendWrite.uncertain}
          fileError={fileError}
          onChange={setPrompt}
          onPick={pick}
          onRemove={(index) => {
            setFileError('');
            setImages((current) => current.filter((_, i) => i !== index));
          }}
          onSend={send}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: chatColors.canvas },
  main: { flex: 1 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 16, gap: 12 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: chatColors.outline,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  activeHistoryRow: { borderColor: colors.primary, backgroundColor: colors.pale },
  historyItem: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  historyTitle: { fontWeight: '700' },
  updatedAt: { fontSize: 12, lineHeight: 18 },
  notice: { color: colors.primaryDeep },
});
