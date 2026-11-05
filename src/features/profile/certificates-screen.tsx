import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../core/api';
import { useReducedMotion } from '../../core/accessibility';
import { useApp } from '../../core/app-context';
import { PickedDocument, pickDocuments } from '../../core/documents';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  IconButton,
  Info,
  PageHeader,
  RemoteState,
  Row,
  Screen,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import {
  Certificate,
  CertificateDraft,
  ProfileMedia,
  validCertificate,
  validateProfileFile,
} from './models';
import { ProfileRepository } from './repository';

const emptyDraft = (): CertificateDraft => ({
  name: '',
  issuedBy: '',
  credential: '',
  issuedDate: '',
  expiryDate: '',
});
const asDraft = (value: Certificate): CertificateDraft => ({
  name: value.name,
  issuedBy: value.issuedBy,
  credential: value.credential,
  issuedDate: value.issuedDate,
  expiryDate: value.expiryDate,
});
const uncertain = (error: unknown) =>
  error instanceof ApiError && (error.uncertain || error.status === 409);

export function CertificatesScreen() {
  const { api, t } = useApp();
  const reducedMotion = useReducedMotion();
  const repo = useMemo(() => new ProfileRepository(api), [api]);
  const remote = useRemote(
    useCallback(async () => {
      const profile = await repo.profile();
      return { caregiverId: profile.id, certificates: await repo.certificates(profile.id) };
    }, [repo]),
  );
  const [visible, setVisible] = useState(false);
  const [existing, setExisting] = useState<Certificate>();
  const [draft, setDraft] = useState(emptyDraft);
  const [baseline, setBaseline] = useState(emptyDraft);
  const [file, setFile] = useState<PickedDocument>();
  const [pickerBusy, setPickerBusy] = useState(false);
  const [fileError, setFileError] = useState('');
  const [fileReview, setFileReview] = useState(false);
  const [reviewLoaded, setReviewLoaded] = useState(false);
  const reviewOwners = useRef(new Set<string>());
  const [unknownCreate, setUnknownCreate] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmation = useRef(false);
  const write = useWrite();
  const media = useRemote(
    useCallback(
      () =>
        existing?.id ? repo.media('CERTIFICATE', existing.id) : Promise.resolve<ProfileMedia[]>([]),
      [repo, existing?.id],
    ),
  );
  const reloadMedia = media.reload;
  useEffect(() => {
    if (visible && existing?.id) reloadMedia();
  }, [visible, existing?.id, reloadMedia]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || !!file;
  const busy = write.busy || pickerBusy || confirming;
  const locked = busy || write.uncertain || needsRefresh || remote.loading || !!remote.error;
  useDirty(visible && dirty, busy);
  async function ask(title: string, hint: string, yes: string) {
    if (confirmation.current) return false;
    confirmation.current = true;
    setConfirming(true);
    const accepted = await confirm(title, hint, yes, t('cancel'));
    confirmation.current = false;
    setConfirming(false);
    return accepted;
  }
  async function close() {
    if (busy) return;
    if (dirty && !(await ask(t('discardTitle'), t('discardHint'), t('discard')))) return;
    setVisible(false);
    setFile(undefined);
  }
  function edit(value?: Certificate) {
    if (locked || (!value && unknownCreate)) return;
    const next = value ? asDraft(value) : emptyDraft();
    setExisting(value);
    setDraft(next);
    setBaseline(next);
    setFile(undefined);
    setFileError('');
    setFileReview(!!value && reviewOwners.current.has(value.id));
    setReviewLoaded(false);
    if (value) setUnknownCreate(false);
    setVisible(true);
  }
  async function reconcile() {
    if (busy) return;
    const fresh = await remote.reload();
    if (!fresh) return;
    if (existing) {
      const latest = fresh.certificates.find((item) => item.id === existing.id);
      if (!latest) {
        setNeedsRefresh(true);
        return;
      }
      setExisting(latest);
      const links = await media.reload();
      if (!links) return;
      if (fileReview) setReviewLoaded(true);
    }
    write.reset();
    setNeedsRefresh(false);
  }
  async function pickFile() {
    if (locked || fileReview || unknownCreate) return;
    setPickerBusy(true);
    setFileError('');
    try {
      const selection = await pickDocuments({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        multiple: false,
      });
      if (selection.canceled) return;
      const selected = selection.assets[0];
      if (!selected || selection.assets.length !== 1) throw new Error();
      validateProfileFile(selected, 'certificate');
      setFile(selected);
    } catch {
      setFileError(t('certInvalidFile'));
    } finally {
      setPickerBusy(false);
    }
  }
  async function save() {
    if (locked || fileReview || unknownCreate || !validCertificate(draft) || !remote.data) return;
    const caregiverId = remote.data.caregiverId;
    let checkpoint = existing;
    let metadataCheckpoint = false;
    await write.run(
      async () => {
        try {
          return await repo.saveCertificateWithFile(
            caregiverId,
            draft,
            existing,
            file,
            (saved, uploaded) => {
              checkpoint = saved;
              setExisting(saved);
              setBaseline(asDraft(saved));
              metadataCheckpoint = true;
              if (uploaded) setFile(undefined);
            },
          );
        } catch (error) {
          if (uncertain(error)) {
            if (!checkpoint) setUnknownCreate(true);
            else if (metadataCheckpoint && file && error instanceof ApiError && error.uncertain) {
              reviewOwners.current.add(checkpoint.id);
              setFileReview(true);
              setReviewLoaded(false);
            }
          }
          throw error;
        }
      },
      async () => {
        setNeedsRefresh(true);
        if (await remote.reload()) {
          setNeedsRefresh(false);
          setVisible(false);
          setFile(undefined);
        }
      },
    );
  }
  async function removeCertificate(value: Certificate) {
    if (locked || !(await ask(t('certDeleteQuestion'), t('certDeleteHint'), t('remove')))) return;
    await write.run(
      () => repo.deleteCertificate(value),
      async () => {
        setNeedsRefresh(true);
        if (await remote.reload()) setNeedsRefresh(false);
      },
    );
  }
  async function removeFile(value: ProfileMedia) {
    if (
      locked ||
      !existing ||
      !(await ask(t('certDeleteFileQuestion'), t('certReviewHint'), t('remove')))
    )
      return;
    await write.run(
      () => repo.removeMedia('CERTIFICATE', existing.id, value.id),
      async () => {
        setNeedsRefresh(true);
        const [fresh, links] = await Promise.all([remote.reload(), media.reload()]);
        if (fresh && links) {
          const latest = fresh.certificates.find((item) => item.id === existing.id);
          if (latest) {
            setExisting(latest);
            setNeedsRefresh(false);
          }
        }
      },
    );
  }
  const formLocked = busy || unknownCreate;
  const refreshButton = (
    <Button
      label={t('certRefresh')}
      kind="secondary"
      disabled={busy || remote.loading || media.loading}
      onPress={() => {
        reconcile();
      }}
    />
  );
  return (
    <>
      <View
        style={styles.fill}
        pointerEvents={visible ? 'none' : 'auto'}
        importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}
      >
        <Screen>
          <PageHeader title={t('certTitle')} description={t('certHint')} />
          {refreshButton}
          <Button label={t('certAdd')} disabled={locked || unknownCreate} onPress={() => edit()} />
          {!visible && <ErrorBox error={write.error} />}
          <ErrorBox error={remote.data ? remote.error : undefined} />
          {!visible && unknownCreate && <Txt muted>{t('certUnknownCreate')}</Txt>}
          {!visible && (write.uncertain || needsRefresh) && (
            <Txt muted>{t('certRefreshRequired')}</Txt>
          )}
          <RemoteState
            loading={remote.loading && !remote.data}
            error={remote.data ? undefined : remote.error}
            retry={reconcile}
          >
            {remote.data?.certificates.length === 0 && (
              <Card>
                <Txt>{t('certEmpty')}</Txt>
              </Card>
            )}
            {remote.data?.certificates.map((item) => (
              <Card key={item.id}>
                <Txt accessibilityRole="header" style={styles.heading}>
                  {item.name}
                </Txt>
                <Info label={t('certIssuer')} value={item.issuedBy} />
                <Badge
                  status={
                    ['PENDING', 'CENTER_VERIFIED', 'ADMIN_VERIFIED', 'REJECTED'].includes(
                      item.status,
                    )
                      ? `cert_${item.status}`
                      : item.status
                  }
                  tone={
                    item.status === 'REJECTED'
                      ? 'danger'
                      : item.status === 'ADMIN_VERIFIED'
                        ? 'success'
                        : item.status === 'CENTER_VERIFIED'
                          ? 'info'
                          : 'warning'
                  }
                />
                {!!item.reason && <Info label={t('certReason')} value={item.reason} />}
                <Info label={t('certIssueDate')} value={item.issuedDate} />
                <Info label={t('certExpiryDate')} value={item.expiryDate} />
                <Button
                  kind="secondary"
                  label={`${t('certEdit')}: ${item.name}`}
                  disabled={locked}
                  onPress={() => edit(item)}
                />
                <Button
                  kind="danger"
                  label={`${t('certDelete')}: ${item.name}`}
                  disabled={locked}
                  onPress={() => {
                    removeCertificate(item);
                  }}
                />
              </Card>
            ))}
          </RemoteState>
        </Screen>
      </View>
      <Modal
        visible={visible}
        transparent
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={() => {
          close();
        }}
      >
        <SafeAreaView style={styles.scrim} edges={['top', 'bottom', 'left', 'right']}>
          <KeyboardAvoidingView style={styles.fill}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScroll}
            >
              <View accessibilityViewIsModal>
                <Card style={styles.form}>
                  <Row>
                    <Txt accessibilityRole="header" style={styles.formTitle}>
                      {t(existing ? 'certEditTitle' : 'certAdd')}
                    </Txt>
                    <IconButton
                      label={t('certClose')}
                      icon="x"
                      disabled={busy}
                      onPress={() => {
                        close();
                      }}
                    />
                  </Row>
                  <Txt muted>{t('certReviewHint')}</Txt>
                  <Field
                    label={t('certNameRequired')}
                    value={draft.name}
                    maxLength={255}
                    editable={!formLocked}
                    onChangeText={(value) => setDraft({ ...draft, name: value })}
                  />
                  <Field
                    label={t('certIssuerRequired')}
                    value={draft.issuedBy}
                    maxLength={255}
                    editable={!formLocked}
                    onChangeText={(value) => setDraft({ ...draft, issuedBy: value })}
                  />
                  <Field
                    label={t('certCredential')}
                    value={draft.credential}
                    maxLength={255}
                    editable={!formLocked}
                    onChangeText={(value) => setDraft({ ...draft, credential: value })}
                  />
                  <Field
                    label={t('certIssueDate')}
                    hint={t('certDateHint')}
                    value={draft.issuedDate}
                    maxLength={10}
                    editable={!formLocked}
                    onChangeText={(value) => setDraft({ ...draft, issuedDate: value })}
                  />
                  <Field
                    label={t('certExpiryDate')}
                    hint={t('certExpiryHint')}
                    value={draft.expiryDate}
                    maxLength={10}
                    editable={!formLocked}
                    onChangeText={(value) => setDraft({ ...draft, expiryDate: value })}
                  />
                  {!validCertificate(draft) && <Txt muted>{t('certValidation')}</Txt>}
                  {existing && (
                    <>
                      <Badge status={existing.status} />
                      {!!existing.reason && <Txt>{existing.reason}</Txt>}
                    </>
                  )}
                  <Txt style={styles.heading}>{t('certFiles')}</Txt>
                  <Txt muted>{t('certFileHint')}</Txt>
                  <ErrorBox error={media.error} />
                  {media.loading && <ActivityIndicator color={colors.primary} />}
                  {media.data?.map((item) => (
                    <Card key={item.id}>
                      <Txt>{item.name || t('certFileFallback')}</Txt>
                      <Button
                        kind="secondary"
                        label={`${t('viewFile')}: ${item.name || t('certFileFallback')}`}
                        disabled={
                          !item.url.startsWith('https://') ||
                          (!!item.expiresAt && Date.parse(item.expiresAt) <= Date.now()) ||
                          busy
                        }
                        onPress={() => {
                          Linking.openURL(item.url).catch(() => setFileError(t('certOpenFailed')));
                        }}
                      />
                      <Button
                        kind="danger"
                        label={`${t('certDeleteFile')}: ${item.name || t('certFileFallback')}`}
                        disabled={locked || fileReview}
                        onPress={() => {
                          removeFile(item);
                        }}
                      />
                    </Card>
                  ))}
                  {file && (
                    <Card>
                      <Txt>{file.name}</Txt>
                      <Txt muted>{t('certFilePending')}</Txt>
                    </Card>
                  )}
                  {fileReview && (
                    <Txt accessibilityLiveRegion="polite" style={styles.error}>
                      {t('certFileReview')}
                    </Txt>
                  )}
                  {(file || fileReview) && (
                    <Button
                      label={t('certRemoveSelection')}
                      kind="secondary"
                      disabled={busy || (fileReview && !reviewLoaded)}
                      onPress={() => {
                        if (existing) reviewOwners.current.delete(existing.id);
                        setFile(undefined);
                        setFileReview(false);
                        setReviewLoaded(false);
                      }}
                    />
                  )}
                  <Button
                    label={t('certChooseFile')}
                    kind="secondary"
                    disabled={locked || fileReview || unknownCreate}
                    loading={pickerBusy}
                    onPress={() => {
                      pickFile();
                    }}
                  />
                  {!!fileError && (
                    <Txt accessibilityLiveRegion="polite" style={styles.error}>
                      {fileError}
                    </Txt>
                  )}
                  <ErrorBox error={write.error} />
                  <ErrorBox error={remote.error} />
                  {unknownCreate && (
                    <Txt accessibilityLiveRegion="polite" style={styles.error}>
                      {t('certUnknownCreate')}
                    </Txt>
                  )}
                  {(write.uncertain || needsRefresh || fileReview || unknownCreate) &&
                    refreshButton}
                  <Button
                    label={t('certSave')}
                    loading={write.busy}
                    disabled={locked || fileReview || unknownCreate || !validCertificate(draft)}
                    onPress={() => {
                      save();
                    }}
                  />
                </Card>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { flex: 1, backgroundColor: colors.scrim },
  modalScroll: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  form: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 },
  formTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700', flex: 1 },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  error: { color: colors.danger },
});
