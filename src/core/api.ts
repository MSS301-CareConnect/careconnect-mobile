import { array, object, required, text } from './json';
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string | null): Promise<void>;
}
export type User = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  roles: string[];
  status: string;
};
export function parseUser(value: unknown): User {
  const j = object(value);
  return {
    id: required(j.id),
    fullName: text(j.fullName),
    email: text(j.email),
    phoneNumber: text(j.phoneNumber),
    roles: array(j.roles).map(required),
    status: required(j.status),
  };
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: number,
    public uncertain = false,
  ) {
    super(`API ${status}/${code}`);
  }
}
export type AuthState = {
  status: 'booting' | 'signedIn' | 'signedOut' | 'restoreError';
  user?: User;
  error?: unknown;
};
export class ApiClient {
  state: AuthState = { status: 'booting' };
  epoch = 0;
  private access: string | null = null;
  private rotation?: Promise<void>;
  private storageQueue: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  constructor(
    private base: string,
    private store: TokenStore,
    private transport: typeof fetch = fetch,
  ) {
    if (!/^https?:\/\/[^/]+\/?$/.test(base)) throw new Error('API URL must be a gateway origin');
    this.base = base.replace(/\/$/, '');
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(state: AuthState) {
    this.state = state;
    this.listeners.forEach((fn) => fn());
  }
  private save(token: string | null) {
    const next = this.storageQueue.catch(() => undefined).then(() => this.store.set(token));
    this.storageQueue = next;
    return next;
  }
  private async raw(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
    access?: string | null,
  ) {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('..') || path.includes('?'))
      throw new Error('Invalid gateway path');
    const params = new URLSearchParams();
    Object.entries(query ?? {}).forEach(([k, v]) => {
      if (v !== undefined) params.set(k, String(v));
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
      const headers: Record<string, string> = {
        'X-Client-Type': 'mobile',
        Accept: 'application/json',
        'Cache-Control': 'no-store',
      };
      if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
      if (access) headers.Authorization = `Bearer ${access}`;
      const response = await this.transport(
        `${this.base}/api/v1${path}${params.size ? '?' + params.toString() : ''}`,
        {
          method,
          headers,
          credentials: 'omit',
          signal: controller.signal,
          body:
            body === undefined ? undefined : multipart ? (body as FormData) : JSON.stringify(body),
        },
      );
      if (response.status === 204) return null;
      let j: Record<string, unknown>;
      try {
        j = object(await response.json());
      } catch {
        throw new ApiError(
          response.status,
          0,
          method !== 'GET' && (response.ok || response.status >= 500 || response.status === 408),
        );
      }
      if (!response.ok || j.code !== 200)
        throw new ApiError(
          response.status,
          typeof j.code === 'number' ? j.code : 0,
          method !== 'GET' && response.status >= 500,
        );
      return j.result;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(0, 0, method !== 'GET');
    } finally {
      clearTimeout(timeout);
    }
  }
  async publicRequest(path: string, body: unknown) {
    // Authentication can be restarted explicitly; no clinical mutation is replayed.
    try {
      return await this.raw('POST', path, body);
    } catch (error) {
      if (error instanceof ApiError) throw new ApiError(error.status, error.code);
      throw error;
    }
  }
  private async refresh(epoch: number) {
    if (this.rotation) return this.rotation;
    const operation = (async () => {
      await this.storageQueue.catch(() => undefined);
      const token = await this.store.get();
      if (!token || epoch !== this.epoch) throw new ApiError(401, 401);
      const j = object(await this.raw('POST', '/auth/refresh', { refreshToken: token }));
      if (epoch !== this.epoch) throw new ApiError(401, 401);
      const access = required(j.accessToken),
        refresh = required(j.refreshToken);
      await this.save(refresh);
      if (epoch !== this.epoch) throw new ApiError(401, 401);
      const user = parseUser(await this.raw('GET', '/users/me', undefined, undefined, access));
      if (epoch !== this.epoch) throw new ApiError(401, 401);
      if (!user.roles.includes('CAREGIVER') || user.status !== 'ACTIVE') {
        const error = new ApiError(403, 403);
        await this.clear(error);
        throw error;
      }
      this.access = access;
    })();
    this.rotation = operation;
    try {
      await operation;
    } finally {
      if (this.rotation === operation) this.rotation = undefined;
    }
  }
  async request(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<unknown> {
    const epoch = this.epoch,
      sentAccess = this.access;
    if (!sentAccess) throw new ApiError(401, 401);
    try {
      let result: unknown;
      try {
        result = await this.raw(method, path, body, query, sentAccess);
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) throw e;
        if (epoch !== this.epoch) throw new ApiError(401, 401);
        if (sentAccess === this.access) await this.refresh(epoch);
        if (epoch !== this.epoch) throw new ApiError(401, 401);
        result = await this.raw(method, path, body, query, this.access);
      }
      if (epoch !== this.epoch) throw new ApiError(401, 401);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && epoch === this.epoch) await this.clear(e);
      throw e;
    }
  }
  async restore() {
    const epoch = this.epoch;
    this.emit({ status: 'booting' });
    try {
      await this.storageQueue.catch(() => undefined);
      if (!(await this.store.get())) {
        if (epoch === this.epoch) this.emit({ status: 'signedOut' });
        return;
      }
      await this.refresh(epoch);
      const user = parseUser(await this.request('GET', '/users/me'));
      if (!user.roles.includes('CAREGIVER') || user.status !== 'ACTIVE')
        throw new ApiError(403, 403);
      if (epoch === this.epoch) this.emit({ status: 'signedIn', user });
    } catch (error) {
      if (epoch !== this.epoch) return;
      if (error instanceof ApiError && [401, 403].includes(error.status)) await this.clear(error);
      else this.emit({ status: 'restoreError', error });
    }
  }
  async login(email: string, password: string) {
    const epoch = ++this.epoch;
    const j = object(await this.publicRequest('/auth/login', { email: email.trim(), password }));
    if (epoch !== this.epoch) throw new ApiError(401, 401);
    this.access = required(j.accessToken);
    await this.save(required(j.refreshToken));
    try {
      const user = parseUser(await this.request('GET', '/users/me'));
      if (!user.roles.includes('CAREGIVER') || user.status !== 'ACTIVE')
        throw new ApiError(403, 403);
      if (epoch === this.epoch) this.emit({ status: 'signedIn', user });
    } catch (e) {
      if (epoch === this.epoch) await this.clear(e);
      throw e;
    }
  }
  async reloadUser() {
    const user = parseUser(await this.request('GET', '/users/me'));
    if (!user.roles.includes('CAREGIVER') || user.status !== 'ACTIVE') {
      await this.clear();
      throw new ApiError(403, 403);
    }
    this.emit({ status: 'signedIn', user });
  }
  private async clear(error?: unknown) {
    ++this.epoch;
    this.access = null;
    this.rotation = undefined;
    const clearing = this.save(null);
    this.emit({ status: 'signedOut', error });
    await clearing;
  }
  async logout(): Promise<boolean> {
    const access = this.access;
    ++this.epoch;
    this.access = null;
    this.rotation = undefined;
    // Reserve capture + clear together before the login screen becomes available.
    const clearing = this.storageQueue
      .catch(() => undefined)
      .then(async () => {
        const token = await this.store.get();
        await this.store.set(null);
        return token;
      });
    this.storageQueue = clearing.then(() => undefined);
    this.emit({ status: 'signedOut' });
    const refreshToken = await clearing;
    if (!refreshToken) return true;
    try {
      await this.raw('POST', '/auth/logout', { refreshToken }, undefined, access);
      return true;
    } catch {
      return false;
    }
  }
}
