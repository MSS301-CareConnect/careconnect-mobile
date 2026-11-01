import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { vietnamDay } from './time';
export function useVietnamDay() {
  const [day, setDay] = useState(vietnamDay);
  useEffect(() => {
    const update = () => setDay(vietnamDay());
    const timer = setInterval(update, 30000);
    const sub = AppState.addEventListener('change', update);
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return day;
}
