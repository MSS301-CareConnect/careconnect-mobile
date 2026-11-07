import { NativeModules } from 'react-native';

export async function copyText(value: string): Promise<void> {
  if (!value.trim()) throw new Error('Empty clipboard text');
  const clipboard = NativeModules.CareConnectClipboard as
    { setText?: (text: string) => Promise<unknown> } | undefined;
  if (!clipboard?.setText) throw new Error('Clipboard unavailable');
  if ((await clipboard.setText(value)) !== true) throw new Error('Clipboard copy failed');
}
