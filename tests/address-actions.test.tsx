import React from 'react';
import { Linking, NativeModules } from 'react-native';
import { afterEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ApiClient } from '../src/core/api';
import { AppProvider } from '../src/core/app-context';
import { copyText } from '../src/core/clipboard';
import { AddressActions } from '../src/features/visits/address-actions';

const address = '42 Hoa Lan, Phường Cầu Kiệu, Thành phố Hồ Chí Minh & Lô #2';
const originalClipboard: unknown = NativeModules.CareConnectClipboard;
afterEach(() => {
  NativeModules.CareConnectClipboard = originalClipboard;
  jest.restoreAllMocks();
});
async function open(value = address) {
  const client = new ApiClient('http://test', {
    get: async () => null,
    set: async () => undefined,
  });
  return render(
    <AppProvider client={client}>
      <AddressActions address={value} />
    </AppProvider>,
  );
}

test('directions opens Google Maps only on tap and encodes the exact displayed address', async () => {
  const maps = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const screen = await open();
  try {
    expect(maps).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Chỉ đường' }));
    expect(maps).toHaveBeenCalledTimes(1);
    const url = new URL(maps.mock.calls[0]?.[0] ?? '');
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('destination')).toBe(address);
    expect(url.searchParams.has('origin')).toBe(false);
    expect(url.searchParams.has('travelmode')).toBe(false);
  } finally {
    await screen.unmount();
  }
});

test('copy waits for the native result, locks repeated taps, and then announces success', async () => {
  let finish: ((result: unknown) => void) | undefined;
  const nativeCopy = jest.fn(
    (_value: string) =>
      new Promise<unknown>((resolve) => {
        finish = resolve;
      }),
  );
  NativeModules.CareConnectClipboard = { setText: nativeCopy };
  const screen = await open();
  try {
    const copy = screen.getByRole('button', { name: 'Sao chép địa chỉ' });
    await fireEvent.press(copy);
    await fireEvent.press(copy);
    expect(nativeCopy).toHaveBeenCalledTimes(1);
    expect(nativeCopy).toHaveBeenCalledWith(address);
    expect(screen.queryByText('Đã sao chép địa chỉ.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sao chép địa chỉ' })).toBeDisabled();
    await act(async () => finish?.(true));
    expect(screen.getByText('Đã sao chép địa chỉ.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sao chép địa chỉ' })).not.toBeDisabled();
  } finally {
    await screen.unmount();
  }
});

test('failed Maps and clipboard actions expose recovery and never claim a successful copy', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No activity'));
  const nativeCopy = jest.fn(async (_value: string) => false);
  NativeModules.CareConnectClipboard = { setText: nativeCopy };
  const screen = await open();
  try {
    await fireEvent.press(screen.getByRole('button', { name: 'Chỉ đường' }));
    expect(screen.getByText(/Không thể mở Google Maps/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sao chép địa chỉ' }));
    expect(screen.getByText(/Không thể sao chép địa chỉ/)).toBeTruthy();
    expect(screen.queryByText('Đã sao chép địa chỉ.')).toBeNull();
    nativeCopy.mockResolvedValueOnce(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Sao chép địa chỉ' }));
    expect(screen.getByText('Đã sao chép địa chỉ.')).toBeTruthy();
  } finally {
    await screen.unmount();
  }
});

test('missing addresses expose no actions, and the clipboard adapter rejects an unavailable native bridge', async () => {
  const screen = await open('   ');
  try {
    expect(screen.queryByRole('button')).toBeNull();
    NativeModules.CareConnectClipboard = undefined;
    await expect(copyText(address)).rejects.toThrow('Clipboard unavailable');
    const setText = jest.fn(async (_value: string) => true);
    NativeModules.CareConnectClipboard = { setText };
    await expect(copyText(' ')).rejects.toThrow('Empty clipboard text');
    expect(setText).not.toHaveBeenCalled();
  } finally {
    await screen.unmount();
  }
});
