import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { BookingRequestRepository } from './repository';

// The server's pending total is independent of notification read state and visible list pages.
export function useBookingRequestCount() {
  const { api } = useApp();
  const focused = useIsFocused();
  const repo = useMemo(() => new BookingRequestRepository(api), [api]);
  const remote = useRemote(useCallback(() => repo.count(), [repo]));
  const { loading, reload } = remote;
  useEffect(() => {
    if (!focused || loading) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void reload();
    }, 30000);
    return () => clearInterval(timer);
  }, [focused, loading, reload]);
  return remote;
}
