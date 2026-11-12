import React from 'react';
import { Image, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../core/app-context';
import { PickedDocument } from '../../core/documents';
import { Txt, colors } from '../../core/ui';
import { ChatIcon, chatColors } from './chat-ui';
import { ChatQuota } from './models';

export function ChatComposer({
  prompt,
  images,
  quota,
  locked,
  sending,
  sendDisabled,
  fileError,
  onChange,
  onPick,
  onRemove,
  onSend,
}: {
  prompt: string;
  images: PickedDocument[];
  quota?: ChatQuota;
  locked: boolean;
  sending: boolean;
  sendDisabled: boolean;
  fileError: string;
  onChange: (value: string) => void;
  onPick: () => void;
  onRemove: (index: number) => void;
  onSend: () => void;
}) {
  const { t } = useApp();
  const mb = 1024 ** 2;
  const attachmentHint =
    quota?.imagesAllowed &&
    t('assistantImageLimits')
      .replace('{count}', String(quota.maxImages))
      .replace('{size}', String(quota.maxImageBytes / mb))
      .replace('{total}', String(quota.maxTotalImageBytes / mb));
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <View style={styles.footer}>
        {images.length > 0 && (
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.attachments}
          >
            {images.map((image, index) => (
              <View key={image.uri + index} style={styles.attachment}>
                <Image source={{ uri: image.uri }} style={styles.thumbnail} accessible={false} />
                <Txt numberOfLines={1} style={styles.fileName}>
                  {image.name}
                </Txt>
                <ChatIcon
                  name="x"
                  label={t('assistantRemoveImage') + ' ' + image.name}
                  disabled={locked}
                  onPress={() => onRemove(index)}
                />
              </View>
            ))}
          </ScrollView>
        )}
        {!!fileError && (
          <Txt accessibilityRole="alert" style={styles.error}>
            {fileError}
          </Txt>
        )}
        <View style={styles.pill}>
          {quota?.imagesAllowed && (
            <ChatIcon
              name="image"
              label={t('assistantAddImages')}
              disabled={locked || images.length >= quota.maxImages}
              onPress={onPick}
            />
          )}
          <TextInput
            accessibilityLabel={t('assistantPrompt')}
            placeholder={t('assistantPlaceholder')}
            placeholderTextColor={colors.muted}
            selectionColor={chatColors.forest}
            value={prompt}
            onChangeText={onChange}
            multiline
            maxLength={quota?.maxPromptLength}
            editable={!locked && !!quota}
            style={[styles.input, !quota?.imagesAllowed && styles.inputWithoutAttachment]}
          />
          <ChatIcon
            name="send"
            label={t('assistantSend')}
            filled
            disabled={sendDisabled}
            busy={sending}
            onPress={onSend}
          />
        </View>
        {!!attachmentHint && (
          <Txt muted style={styles.hint}>
            {attachmentHint}
          </Txt>
        )}
        {images.length > 0 && (
          <Txt muted style={styles.hint}>
            {t('assistantPrivacy')}
          </Txt>
        )}
        <Txt muted style={styles.hint}>
          {t('assistantDisclaimer')}
        </Txt>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: chatColors.outline },
  footer: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    padding: 4,
    borderRadius: 28,
    borderColor: chatColors.outline,
    borderWidth: 1,
    backgroundColor: chatColors.wash,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    maxHeight: 108,
    color: colors.ink,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  inputWithoutAttachment: { paddingLeft: 12 },
  hint: { fontSize: 12, lineHeight: 17 },
  error: { color: colors.danger },
  attachments: { gap: 8, alignItems: 'center' },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 208,
    borderRadius: 12,
    borderColor: chatColors.outline,
    borderWidth: 1,
    paddingLeft: 5,
    gap: 6,
  },
  thumbnail: { width: 38, height: 38, borderRadius: 7, backgroundColor: chatColors.wash },
  fileName: { flexShrink: 1, fontSize: 13, lineHeight: 19 },
});
