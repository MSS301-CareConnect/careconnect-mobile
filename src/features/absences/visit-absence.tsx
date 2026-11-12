import React, { useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Routes } from '../../app/routes';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { Badge, Button, RemoteState, Section, Txt } from '../../core/ui';
import { AbsenceRepository } from './repository';

export function VisitAbsence({
  bookingId,
  occurrenceId,
}: {
  bookingId: string;
  occurrenceId: string;
}) {
  const { api, t } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<Routes>>();
  const repo = useMemo(() => new AbsenceRepository(api), [api]);
  const remote = useRemote(
    useCallback(() => repo.forVisit(bookingId, occurrenceId), [repo, bookingId, occurrenceId]),
  );
  const item = remote.data;
  return (
    <Section title={t('absences')} icon="user-x">
      <RemoteState {...remote} retry={remote.reload}>
        {item ? (
          <>
            <Badge
              status={`absenceStatus_${item.status}`}
              tone={item.status === 'PENDING' ? 'warning' : 'neutral'}
            />
            <Txt muted>{t(`absenceSource_${item.source}`)}</Txt>
            <Txt>{item.explanation || t('absenceNoExplanation')}</Txt>
            {!!item.conclusionNote && <Txt>{item.conclusionNote}</Txt>}
            {item.status === 'PENDING' && (
              <Button
                label={t(item.explanation ? 'absenceEditExplanation' : 'absenceExplain')}
                onPress={() => navigation.navigate('AbsenceExplain', { id: item.id })}
              />
            )}
          </>
        ) : (
          <Txt muted>{t('absenceVisitUnavailable')}</Txt>
        )}
      </RemoteState>
    </Section>
  );
}
