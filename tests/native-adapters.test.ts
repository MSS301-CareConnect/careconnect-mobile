import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AppState, PermissionsAndroid, Platform, type PermissionStatus } from 'react-native';
import { pick, type DocumentPickerResponse } from '@react-native-documents/picker';
import Geolocation, { type GeolocationResponse } from '@react-native-community/geolocation';
import * as Keychain from 'react-native-keychain';
import { pickDocuments } from '../src/core/documents';
import { tokenStore } from '../src/core/token-store';
import { optionalCoordinates } from '../src/core/device';

const initialAppState = AppState.currentState;

jest.mock(
  '@react-native-documents/picker',
  () => ({
    pick: jest.fn(),
    errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
    isErrorWithCode: (error: unknown) =>
      error instanceof Error && 'code' in error && typeof error.code === 'string',
  }),
  { virtual: true },
);
jest.mock(
  'react-native-keychain',
  () => ({
    getGenericPassword: jest.fn(),
    setGenericPassword: jest.fn(),
    resetGenericPassword: jest.fn(),
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
    STORAGE_TYPE: { AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth' },
  }),
  { virtual: true },
);
jest.mock(
  '@react-native-community/geolocation',
  () => ({
    __esModule: true,
    default: {
      setRNConfiguration: jest.fn(),
      requestAuthorization: jest.fn(),
      getCurrentPosition: jest.fn(),
      watchPosition: jest.fn(),
    },
  }),
  { virtual: true },
);

const selected: DocumentPickerResponse = {
  uri: 'content://documents/photo-1',
  name: 'photo.png',
  type: 'image/png',
  nativeType: 'image/png',
  size: 1024,
  error: null,
  hasRequestedType: true,
  isVirtual: false,
  convertibleToMimeTypes: null,
};

afterEach(() => {
  AppState.currentState = initialAppState;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('document selection boundary', () => {
  test('opens original documents without copies or long-term access and normalizes metadata', async () => {
    jest.mocked(pick).mockResolvedValueOnce([selected]);

    await expect(pickDocuments({ type: ['image/png'], multiple: true })).resolves.toEqual({
      canceled: false,
      assets: [
        {
          uri: 'content://documents/photo-1',
          name: 'photo.png',
          mimeType: 'image/png',
          size: 1024,
        },
      ],
    });
    expect(pick).toHaveBeenCalledWith({
      type: ['image/png'],
      allowMultiSelection: true,
      mode: 'open',
      requestLongTermAccess: false,
      allowVirtualFiles: false,
    });
  });

  test('leaves unavailable type and size unknown instead of inventing upload metadata', async () => {
    jest.mocked(pick).mockResolvedValueOnce([{ ...selected, type: null, size: null }]);
    await expect(pickDocuments({ type: ['image/png'], multiple: false })).resolves.toEqual({
      canceled: false,
      assets: [{ uri: 'content://documents/photo-1', name: 'photo.png' }],
    });
  });

  test('maps user cancellation to an empty canceled result', async () => {
    const canceled = Object.assign(new Error('Canceled'), { code: 'OPERATION_CANCELED' });
    jest.mocked(pick).mockRejectedValueOnce(canceled);
    await expect(pickDocuments({ type: ['image/png'], multiple: false })).resolves.toEqual({
      canceled: true,
      assets: null,
    });
  });

  test('propagates native failures rather than treating them as cancellation', async () => {
    const failure = Object.assign(new Error('Picker unavailable'), {
      code: 'UNABLE_TO_OPEN_FILE_TYPE',
    });
    jest.mocked(pick).mockRejectedValueOnce(failure);
    await expect(pickDocuments({ type: ['image/png'], multiple: false })).rejects.toBe(failure);
  });

  test.each([
    { error: 'Metadata unavailable' },
    { name: null },
    { uri: '' },
    { hasRequestedType: false },
    { isVirtual: true },
  ])('rejects unusable provider metadata %j before upload', async (invalid) => {
    jest.mocked(pick).mockResolvedValueOnce([{ ...selected, ...invalid }]);
    await expect(pickDocuments({ type: ['image/png'], multiple: false })).rejects.toThrow();
  });
});

describe('secure refresh-token boundary', () => {
  beforeEach(() => {
    jest.mocked(Keychain.getGenericPassword).mockReset();
    jest.mocked(Keychain.setGenericPassword).mockReset();
    jest.mocked(Keychain.resetGenericPassword).mockReset();
  });

  test('stores only the refresh token in an isolated, device-only keychain service', async () => {
    jest
      .mocked(Keychain.setGenericPassword)
      .mockResolvedValueOnce({ service: 'saved', storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH });
    await tokenStore.set('refresh-token-fixture');
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'refresh-token',
      'refresh-token-fixture',
      expect.objectContaining({
        service: 'vn.careconnect.careconnect_mobile.refresh',
        accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
      }),
    );
  });

  test('reads only the refresh-token entry and returns null for a missing entry', async () => {
    jest
      .mocked(Keychain.getGenericPassword)
      .mockResolvedValueOnce({
        username: 'refresh-token',
        password: 'refresh-token-fixture',
        service: 'vn.careconnect.careconnect_mobile.refresh',
        storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
      })
      .mockResolvedValueOnce(false);
    await expect(tokenStore.get()).resolves.toBe('refresh-token-fixture');
    await expect(tokenStore.get()).resolves.toBeNull();
    expect(Keychain.getGenericPassword).toHaveBeenCalledWith({
      service: 'vn.careconnect.careconnect_mobile.refresh',
    });
  });

  test('deletes its service when clearing the token rather than writing a placeholder', async () => {
    jest.mocked(Keychain.resetGenericPassword).mockResolvedValueOnce(true);
    await tokenStore.set(null);
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'vn.careconnect.careconnect_mobile.refresh',
    });
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  });

  test('does not interpret another keychain account as a refresh token', async () => {
    jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
      username: 'another-account',
      password: 'unrelated-fixture',
      service: 'vn.careconnect.careconnect_mobile.refresh',
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
    await expect(tokenStore.get()).resolves.toBeNull();
  });

  test('propagates storage failures so the session cannot claim an unsaved refresh token', async () => {
    const failure = new Error('Keystore unavailable');
    jest.mocked(Keychain.getGenericPassword).mockRejectedValueOnce(failure);
    await expect(tokenStore.get()).rejects.toBe(failure);
    jest.mocked(Keychain.setGenericPassword).mockResolvedValueOnce(false);
    await expect(tokenStore.set('refresh-token-fixture')).rejects.toThrow();
    jest.mocked(Keychain.resetGenericPassword).mockRejectedValueOnce(failure);
    await expect(tokenStore.set(null)).rejects.toBe(failure);
    jest.mocked(Keychain.resetGenericPassword).mockResolvedValueOnce(false);
    await expect(tokenStore.set(null)).rejects.toThrow();
  });
});

const position: GeolocationResponse = {
  coords: {
    latitude: 10.78,
    longitude: 106.69,
    accuracy: 500,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 1,
};

function androidPermissions(coarse: PermissionStatus, fine: PermissionStatus) {
  // RN types list every permission; the native result only contains the requested keys.
  return {
    'android.permission.ACCESS_COARSE_LOCATION': coarse,
    'android.permission.ACCESS_FINE_LOCATION': fine,
  } as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>;
}

describe('optional foreground coordinates', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.replaceProperty(Platform, 'OS', 'android');
    AppState.currentState = 'active';
    jest.mocked(Geolocation.getCurrentPosition).mockReset();
    jest.mocked(Geolocation.requestAuthorization).mockReset();
    jest.mocked(Geolocation.setRNConfiguration).mockClear();
    jest
      .spyOn(PermissionsAndroid, 'requestMultiple')
      .mockResolvedValue(androidPermissions('granted', 'granted'));
  });

  test('accepts approximate Android permission and requests one bounded current position', async () => {
    jest
      .spyOn(PermissionsAndroid, 'requestMultiple')
      .mockResolvedValueOnce(androidPermissions('granted', 'denied'));
    jest
      .mocked(Geolocation.getCurrentPosition)
      .mockImplementationOnce((success) => success(position));

    await expect(optionalCoordinates()).resolves.toEqual({ latitude: 10.78, longitude: 106.69 });
    expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith([
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ]);
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 0,
      },
    );
    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
    expect(Geolocation.setRNConfiguration).toHaveBeenCalledWith({
      skipPermissionRequests: true,
      enableBackgroundLocationUpdates: false,
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('omits coordinates and does not start location when both Android permissions are denied', async () => {
    jest
      .spyOn(PermissionsAndroid, 'requestMultiple')
      .mockResolvedValueOnce(androidPermissions('denied', 'never_ask_again'));
    await expect(optionalCoordinates()).resolves.toEqual({});
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  test('returns without requesting permissions on unsupported platforms', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await expect(optionalCoordinates()).resolves.toEqual({});
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
    expect(Geolocation.requestAuthorization).not.toHaveBeenCalled();
  });

  test('returns without coordinates after six seconds even if the native location callback stalls', async () => {
    jest
      .spyOn(PermissionsAndroid, 'requestMultiple')
      .mockResolvedValueOnce(androidPermissions('granted', 'granted'));
    const result = optionalCoordinates();
    await jest.advanceTimersByTimeAsync(6000);
    await expect(result).resolves.toEqual({});
  });

  test('does not start a late position request after the permission prompt outlives the timeout', async () => {
    let authorize:
      ((value: Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>) => void) | undefined;
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          authorize = resolve;
        }),
    );
    const result = optionalCoordinates();
    await jest.advanceTimersByTimeAsync(6000);
    await expect(result).resolves.toEqual({});
    authorize?.(androidPermissions('granted', 'granted'));
    await Promise.resolve();
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  test('does not request coordinates in the background', async () => {
    AppState.currentState = 'background';
    await expect(optionalCoordinates()).resolves.toEqual({});
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
  });

  test('does not start location if the app backgrounds while permission is pending', async () => {
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockImplementationOnce(async () => {
      AppState.currentState = 'background';
      return androidPermissions('granted', 'granted');
    });
    await expect(optionalCoordinates()).resolves.toEqual({});
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  test('omits coordinates when the native location provider fails', async () => {
    jest.mocked(Geolocation.getCurrentPosition).mockImplementationOnce((_success, error) =>
      error?.({
        code: 2,
        message: 'Unavailable',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      }),
    );
    await expect(optionalCoordinates()).resolves.toEqual({});
    expect(jest.getTimerCount()).toBe(0);
  });

  test('omits invalid native coordinates instead of sending unusable values', async () => {
    jest.mocked(Geolocation.getCurrentPosition).mockImplementationOnce((success) =>
      success({
        ...position,
        coords: { ...position.coords, latitude: NaN },
      }),
    );
    await expect(optionalCoordinates()).resolves.toEqual({});
  });
});
