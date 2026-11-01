import Geolocation from '@react-native-community/geolocation';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

type Coordinates = { latitude?: number; longitude?: number };

async function foregroundPermission(): Promise<boolean> {
  Geolocation.setRNConfiguration({
    skipPermissionRequests: true,
    enableBackgroundLocationUpdates: false,
  });
  const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const result = await PermissionsAndroid.requestMultiple([coarse, fine]);
  return (
    result[coarse] === PermissionsAndroid.RESULTS.GRANTED ||
    result[fine] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export function optionalCoordinates(): Promise<Coordinates> {
  if (Platform.OS !== 'android' || AppState.currentState !== 'active') return Promise.resolve({});
  return new Promise((resolve) => {
    let settled = false;
    const finish = (coordinates: Coordinates = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(coordinates);
    };
    const timeout = setTimeout(() => finish(), 6000);
    void foregroundPermission().then(
      (granted) => {
        if (settled) return;
        if (!granted || AppState.currentState !== 'active') {
          finish();
          return;
        }
        try {
          Geolocation.getCurrentPosition(
            ({ coords: { latitude, longitude } }) => {
              if (
                AppState.currentState === 'active' &&
                Number.isFinite(latitude) &&
                Number.isFinite(longitude) &&
                Math.abs(latitude) <= 90 &&
                Math.abs(longitude) <= 180
              )
                finish({ latitude, longitude });
              else finish();
            },
            () => finish(),
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 0 },
          );
        } catch {
          finish();
        }
      },
      () => finish(),
    );
  });
}
