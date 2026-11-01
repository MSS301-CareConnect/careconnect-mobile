import { jest, test, expect } from '@jest/globals';
import { ApiClient, ApiError } from '../src/core/api';
const me = { id: 'user-1', fullName: 'Caregiver', roles: ['CAREGIVER'], status: 'ACTIVE' };
function setup(handler: (path: string, init?: RequestInit) => Promise<Response>) {
  let token: string | null = 'refresh';
  const storage = {
    get: async () => token,
    set: async (v: string | null) => {
      token = v;
    },
  };
  const fetcher = jest.fn((input: string | URL | Request, init?: RequestInit) =>
    handler(String(input).replace('http://localhost/api/v1', ''), init),
  );
  return { api: new ApiClient('http://localhost', storage, fetcher), fetcher, stored: () => token };
}
const reply = (result: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify({ code: status, result }), { status }));
test('restores via mobile body token and validates actual caregiver account', async () => {
  const { api, fetcher, stored } = setup((path) =>
    path === '/auth/refresh'
      ? reply({ accessToken: 'access', refreshToken: 'rotated' })
      : reply(me),
  );
  await api.restore();
  expect(api.state.status).toBe('signedIn');
  expect(stored()).toBe('rotated');
  expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ 'X-Client-Type': 'mobile' });
  expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ refreshToken: 'refresh' });
});
test('parallel unauthorized reads share a single refresh', async () => {
  let refreshes = 0;
  const { api } = setup((path, init) => {
    if (path === '/auth/refresh') {
      refreshes++;
      return reply({ accessToken: 'a' + refreshes, refreshToken: 'r' + refreshes });
    }
    if (path === '/users/me') return reply(me);
    return (init?.headers as Record<string, string>).Authorization === 'Bearer a1'
      ? reply(null, 401)
      : reply('ok');
  });
  await api.restore();
  await Promise.all([api.request('GET', '/one'), api.request('GET', '/two')]);
  expect(refreshes).toBe(2);
});
test('uncertain writes are never retried and identify reconciliation requirement', async () => {
  const { api, fetcher } = setup((path) =>
    path === '/auth/refresh'
      ? reply({ accessToken: 'a', refreshToken: 'r' })
      : path === '/users/me'
        ? reply(me)
        : Promise.reject(new TypeError('network')),
  );
  await api.restore();
  await expect(api.request('POST', '/care-sessions', {})).rejects.toMatchObject({
    uncertain: true,
  });
  expect(
    fetcher.mock.calls.filter(([path]) => String(path).endsWith('/care-sessions')),
  ).toHaveLength(1);
});
test('temporary restore failure retains refresh token and allows retry', async () => {
  const { api, stored } = setup(() => reply(null, 503));
  await api.restore();
  expect(api.state.status).toBe('restoreError');
  expect(stored()).toBe('refresh');
});
test('wrong role is denied and clears stored refresh token', async () => {
  const { api, stored } = setup((path) =>
    path === '/auth/refresh'
      ? reply({ accessToken: 'a', refreshToken: 'r' })
      : reply({ ...me, roles: ['CUSTOMER'] }),
  );
  await api.restore();
  expect(api.state.status).toBe('signedOut');
  expect(stored()).toBeNull();
});
test('logout prevents late refresh from restoring credentials', async () => {
  let finish!: (r: Response) => void;
  const { api, stored } = setup((path) =>
    path === '/auth/refresh'
      ? new Promise<Response>((resolve) => {
          finish = resolve;
        })
      : reply(null),
  );
  const restore = api.restore();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  const logout = api.logout();
  finish(
    new Response(
      JSON.stringify({ code: 200, result: { accessToken: 'late', refreshToken: 'late' } }),
    ),
  );
  await Promise.all([restore, logout]);
  expect(api.state.status).toBe('signedOut');
  expect(stored()).toBeNull();
  await expect(api.request('GET', '/protected')).rejects.toBeInstanceOf(ApiError);
});

test('HTML gateway failures leave write result uncertain', async () => {
  const { api } = setup((path) =>
    path === '/auth/refresh'
      ? reply({ accessToken: 'a', refreshToken: 'r' })
      : path === '/users/me'
        ? reply(me)
        : Promise.resolve(new Response('<html>bad gateway</html>', { status: 502 })),
  );
  await api.restore();
  await expect(
    api.request('POST', '/care-sessions/s/notes', { content: 'note' }),
  ).rejects.toMatchObject({ uncertain: true });
});
test('old logout storage read cannot erase a subsequent login refresh', async () => {
  let token: string | null = null;
  let release!: () => void;
  let getStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    getStarted = resolve;
  });
  const store = {
    get: async () => {
      const snapshot = token;
      getStarted();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return snapshot;
    },
    set: async (v: string | null) => {
      token = v;
    },
  };
  let logins = 0;
  const api = new ApiClient('http://localhost', store, async (input) =>
    String(input).endsWith('/auth/login')
      ? reply({ accessToken: 'a' + ++logins, refreshToken: 'r' + logins })
      : String(input).endsWith('/users/me')
        ? reply(me)
        : reply(null),
  );
  await api.login('one@example.test', 'password');
  const logout = api.logout();
  await started;
  const login = api.login('two@example.test', 'password');
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  release();
  await Promise.all([logout, login]);
  expect(token).toBe('r2');
  expect(api.state.status).toBe('signedIn');
});

test('refresh cannot keep a revoked caregiver inside the protected session', async () => {
  let refreshes = 0;
  const { api, stored } = setup((path, init) => {
    if (path === '/auth/refresh') {
      refreshes++;
      return reply({ accessToken: 'a' + refreshes, refreshToken: 'r' + refreshes });
    }
    if (path === '/users/me')
      return reply({ ...me, roles: refreshes > 1 ? ['CUSTOMER'] : ['CAREGIVER'] });
    return (init?.headers as Record<string, string>).Authorization === 'Bearer a1'
      ? reply(null, 401)
      : reply('protected');
  });
  await api.restore();
  await expect(api.request('GET', '/care-sessions/s')).rejects.toBeInstanceOf(ApiError);
  expect(api.state.status).toBe('signedOut');
  expect(stored()).toBeNull();
});
