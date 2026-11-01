import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { ApiClient, User } from './api';
import { Locale, translate } from './l10n';
import { tokenStore } from './token-store';
const origin = process.env.API_URL ?? (__DEV__ ? 'http://10.0.2.2:8080' : '');
function createApi() {
  if (!__DEV__ && !origin.startsWith('https://'))
    throw new Error('Release requires HTTPS gateway configuration');
  return new ApiClient(origin, tokenStore);
}
type AppContext = {
  api: ApiClient;
  user?: User;
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  logout: () => Promise<void>;
};
const Context = createContext<AppContext | null>(null);
export function AppProvider({
  children,
  client,
}: {
  children: React.ReactNode;
  client?: ApiClient;
}) {
  const [api] = useState(() => client ?? createApi());
  const [state, setState] = useState(api.state);
  const [locale, setLocale] = useState<Locale>('vi');
  const t = (key: string) => translate(locale, key);
  useEffect(() => {
    const off = api.subscribe(() => setState(api.state));
    void api.restore();
    return off;
  }, [api]);
  async function logout() {
    const confirmed = await api.logout();
    if (!confirmed) Alert.alert(translate(locale, 'logout'), translate(locale, 'logoutFailed'));
  }
  return (
    <Context.Provider value={{ api, user: state.user, locale, setLocale, t, logout }}>
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('AppProvider missing');
  return value;
}
