import React, { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useApp } from '../../core/app-context';
import { copyText } from '../../core/clipboard';
import { Button, IconButton, Txt, colors } from '../../core/ui';

export function AddressActions({ address }: { address: string }) {
  const { t } = useApp();
  const [busy, setBusy] = useState<'maps' | 'copy'>();
  const [message, setMessage] = useState('');
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function act(kind: 'maps' | 'copy') {
    if (locked.current || !address.trim()) return;
    locked.current = true;
    setBusy(kind);
    setMessage('');
    try {
      if (kind === 'copy') await copyText(address);
      else
        await Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
        );
      if (mounted.current && kind === 'copy') setMessage('addressCopied');
    } catch {
      if (mounted.current) setMessage(kind === 'copy' ? 'addressCopyError' : 'addressMapsError');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(undefined);
    }
  }
  if (!address.trim()) return null;
  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <View style={styles.directions}>
          <Button
            kind="secondary"
            icon="navigation"
            label={t('addressDirections')}
            loading={busy === 'maps'}
            disabled={!!busy}
            onPress={() => {
              act('maps');
            }}
          />
        </View>
        <IconButton
          icon="copy"
          label={t('addressCopy')}
          disabled={!!busy}
          onPress={() => {
            act('copy');
          }}
        />
      </View>
      {!!message && (
        <Txt
          accessibilityLiveRegion="polite"
          accessibilityRole={message === 'addressCopied' ? undefined : 'alert'}
          style={message === 'addressCopied' ? styles.success : styles.error}
        >
          {t(message)}
        </Txt>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  directions: { flex: 1, minWidth: 0 },
  success: { color: colors.primary },
  error: { color: colors.danger },
});
