import * as Keychain from 'react-native-keychain';
import type { TokenStore } from './api';

const service = 'vn.careconnect.careconnect_mobile.refresh';
const account = 'refresh-token';

export const tokenStore: TokenStore = {
  async get() {
    const credentials = await Keychain.getGenericPassword({ service });
    return credentials && credentials.username === account ? credentials.password : null;
  },
  async set(token) {
    if (token === null) {
      if (!(await Keychain.resetGenericPassword({ service })))
        throw new Error('Secure token removal failed');
      return;
    }
    const saved = await Keychain.setGenericPassword(account, token, {
      service,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (!saved) throw new Error('Secure token storage failed');
  },
};
