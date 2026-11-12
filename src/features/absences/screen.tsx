import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Props } from '../../app/routes';
import { ApiError } from '../../core/api';
import { useApp } from '../../core/app-context';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { formatInstant } from '../../core/time';
import {
  Badge,
  BadgeTone,
  Button,
  Card,
  Chips,
  ErrorBox,
  Field,
  PageHeader,
  Pagination,
  RemoteState,
  Screen,
  Txt,
} from '../../core/ui';
import { Absence, AbsenceStatus, EXPLANATION_MAX, checkExplanation } from './models';
import { AbsenceRepository } from './repository';
import { useAbsenceVisitLabel } from './presentation';

const TONES: Record<AbsenceStatus, BadgeTone> = {
  PENDING: 'warning',
  EXCUSED: 'neutral',
  CONFIRMED: 'danger',
};
type Filter = 'PENDING' | 'ALL';

function AbsenceCard({ item, onExplain }: { item: Absence; onExplain: () => void }) {
  const { t, locale } = useApp();
  const visitLabel = useAbsenceVisitLabel();
  return (
    <Card>
      <View style={styles.row}>
        <Txt style={styles.strong}>{visitLabel(item)}</Txt>
        <Badge status={`absenceStatus_${item.status}`} tone={TONES[item.status]} />
      </View>
      <Txt muted>
        {[item.bookingCode, item.recipientName, t(`absenceSource_${item.source}`)]
          .filter(Boolean)
          .join(' · ')}
      </Txt>
      <Txt>
        {item.explanation
          ? `${t('absenceExplanation')}: ${item.explanation}`
          : t('absenceNoExplanation')}
      </Txt>
      {item.explainedAt ? (
        <Txt muted>
          {t('absenceExplainedAt')} {formatInstant(item.explainedAt, locale)}
        </Txt>
      ) : null}
      {item.status !== 'PENDING' ? (
        <Txt>
          {item.conclusionNote
            ? `${t('absenceConclusion')}: ${item.conclusionNote}`
            : t(`absenceStatus_${item.status}`)}
        </Txt>
      ) : (
        <Button
          icon="edit-3"
          label={t(item.explanation ? 'absenceEditExplanation' : 'absenceExplain')}
          onPress={onExplain}
        />
      )}
    </Card>
  );
}

// Missed visits of the signed-in caregiver (2026-11-10): explain each one before the center concludes.
export function AbsencesScreen({ navigation }: Props<'Absences'>) {
  const { api, t } = useApp();
  const repo = useMemo(() => new AbsenceRepository(api), [api]);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [p, setPage] = useState(0);
  const remote = useRemote(
    useCallback(
      () => repo.list(filter === 'PENDING' ? 'PENDING' : undefined, p),
      [repo, filter, p],
    ),
  );
  return (
    <Screen>
      <PageHeader title={t('absences')} description={t('absencesHint')} />
      <Chips
        values={[
          { value: 'PENDING', label: t('absenceFilterPending') },
          { value: 'ALL', label: t('absenceFilterAll') },
        ]}
        value={filter}
        onChange={(next) => {
          setFilter(next as Filter);
          setPage(0);
        }}
      />
      <RemoteState {...remote} retry={() => void remote.reload()}>
        {remote.data?.items.length === 0 && (
          <Card>
            <Txt muted>{t(filter === 'PENDING' ? 'absencesEmptyPending' : 'absencesEmpty')}</Txt>
          </Card>
        )}
        {remote.data?.items.map((item) => (
          <AbsenceCard
            key={item.id}
            item={item}
            onExplain={() => navigation.navigate('AbsenceExplain', { id: item.id })}
          />
        ))}
        {remote.data && remote.data.totalPages > 1 && (
          <Pagination {...remote.data} onChange={setPage} />
        )}
      </RemoteState>
    </Screen>
  );
}

// Send or edit the explanation; BookingService refuses once the center concluded (409 5271).
export function AbsenceExplainScreen({ navigation, route }: Props<'AbsenceExplain'>) {
  const { api, t } = useApp();
  const repo = useMemo(() => new AbsenceRepository(api), [api]);
  const visitLabel = useAbsenceVisitLabel();
  const id = route.params.id;
  const remote = useRemote(useCallback(() => repo.get(id), [repo, id]));
  const write = useWrite();
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const value = draft ?? remote.data?.explanation ?? '';
  useDirty(!sent && draft !== undefined && draft !== remote.data?.explanation, write.busy);
  useEffect(() => {
    if (sent) navigation.goBack();
  }, [sent, navigation]);
  const serverField =
    write.error instanceof ApiError && write.error.code === 5272
      ? 'absenceExplanationShort'
      : undefined;

  async function submit() {
    const checked = checkExplanation(value);
    setError(checked.error);
    if (!checked.text) return;
    const explanation = checked.text;
    await write.run(
      () => repo.explain(id, explanation),
      () => setSent(true),
    );
  }
  async function reconcile() {
    const saved = await remote.reload();
    if (!saved) return;
    if (saved.explanation === value.trim()) setSent(true);
    write.reset();
  }
  return (
    <Screen>
      <PageHeader title={t('absenceExplainTitle')} description={t('absenceExplainHint')} />
      <RemoteState {...remote} retry={write.uncertain ? reconcile : remote.reload}>
        {remote.data &&
          (remote.data.status !== 'PENDING' ? (
            <Card>
              <Txt>{t('absenceAlreadyConcluded')}</Txt>
            </Card>
          ) : (
            <Card>
              <Txt style={styles.strong}>{visitLabel(remote.data)}</Txt>
              <Txt muted>{t('absenceRefunded')}</Txt>
              <Field
                label={t('absenceExplanation')}
                multiline
                maxLength={EXPLANATION_MAX}
                value={value}
                editable={!write.busy && !write.uncertain}
                onChangeText={(next) => {
                  setDraft(next);
                  setError(undefined);
                  write.reset();
                }}
                hint={t('absenceExplanationHint')}
                error={error || serverField ? t(error ?? serverField ?? '') : undefined}
              />
              {write.error && !serverField ? (
                <ErrorBox
                  error={write.error}
                  messageKey={
                    write.error instanceof ApiError && write.error.code === 5271
                      ? 'absenceAlreadyConcluded'
                      : undefined
                  }
                />
              ) : null}
              {write.uncertain && (
                <Button label={t('requestReconcile')} kind="secondary" onPress={reconcile} />
              )}
              <Button
                icon="send"
                label={t('absenceSubmit')}
                loading={write.busy}
                disabled={write.uncertain}
                onPress={() => void submit()}
              />
            </Card>
          ))}
      </RemoteState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  strong: { fontWeight: '700', flexShrink: 1 },
});
