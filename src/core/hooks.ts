import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useIsFocused, useNavigation, usePreventRemove } from '@react-navigation/native';
import { ApiError } from './api';
import { useApp } from './app-context';
import { confirm } from './ui';
class RemoteResource<T> {
  private generation = 0;
  private snapshot: { data?: T; loading: boolean; error?: unknown } = { loading: true };
  private listeners = new Set<() => void>();
  constructor(private loader: () => Promise<T>) {}
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.snapshot;
  private emit(next: typeof this.snapshot) {
    this.snapshot = next;
    this.listeners.forEach((fn) => fn());
  }
  invalidate = () => {
    this.generation++;
  };
  reload = async () => {
    const id = ++this.generation;
    this.emit({ ...this.snapshot, loading: true, error: undefined });
    try {
      const data = await this.loader();
      if (id === this.generation) {
        this.emit({ data, loading: false });
        return data;
      }
    } catch (error) {
      if (id === this.generation) this.emit({ ...this.snapshot, loading: false, error });
    }
  };
}
export function useRemote<T>(loader: () => Promise<T>) {
  const resource = useMemo(() => new RemoteResource(loader), [loader]);
  const focused = useIsFocused();
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot);
  useEffect(() => {
    if (focused) void resource.reload();
    return resource.invalidate;
  }, [focused, resource]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      resource.invalidate();
      if (state === 'active' && focused) void resource.reload();
    });
    return () => listener.remove();
  }, [focused, resource]);
  return { ...snapshot, reload: resource.reload };
}
export function useWrite() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const locked = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run<T>(action: () => Promise<T>, success?: (value: T) => void | Promise<void>) {
    if (locked.current || uncertain) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const value = await action();
      if (mounted.current) await success?.(value);
      return value;
    } catch (e) {
      if (mounted.current) {
        setError(e);
        setUncertain(e instanceof ApiError && (e.uncertain || e.status === 409));
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    busy,
    error,
    uncertain,
    run,
    reset: () => {
      setError(undefined);
      setUncertain(false);
    },
  };
}
export function useDirty(dirty: boolean, busy = false) {
  const { t } = useApp();
  const navigation = useNavigation();
  usePreventRemove(dirty || busy, ({ data }) => {
    if (!busy)
      void confirm(t('discardTitle'), t('discardHint'), t('discard'), t('cancel')).then((ok) => {
        if (ok) navigation.dispatch(data.action);
      });
  });
}
