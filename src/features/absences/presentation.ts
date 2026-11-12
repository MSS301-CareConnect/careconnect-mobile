import { useApp } from '../../core/app-context';
import { formatInstant } from '../../core/time';
import { Absence } from './models';

export function useAbsenceVisitLabel() {
  const { t, locale } = useApp();
  return (item: Absence) => {
    const label =
      item.occurrenceNo === undefined
        ? ''
        : t('absenceVisit').replace('{number}', String(item.occurrenceNo)) + ' · ';
    return (
      label +
      formatInstant(item.startAt, locale) +
      ' – ' +
      formatInstant(item.endAt, locale, { hour: '2-digit', minute: '2-digit' })
    );
  };
}
