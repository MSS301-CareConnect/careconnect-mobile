import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { pickDocuments } from '../../core/documents';
import { useApp } from '../../core/app-context';
import { useDirty, useRemote, useWrite } from '../../core/hooks';
import { Props } from '../../app/routes';
import {
  Badge,
  Button,
  Chips,
  ErrorBox,
  Field,
  RemoteState,
  Screen,
  Section,
  Title,
  Txt,
  colors,
  confirm,
} from '../../core/ui';
import { SessionRepository } from '../sessions/repository';
import { Report, ReportPhotoInput, conditions, emptyReport, reportFields } from './models';
import { ReportRepository } from './repository';
function signature(r: Report) {
  return JSON.stringify([r.overallCondition, ...reportFields.map((k) => r[k])]);
}
export function ReportScreen({ route }: Props<'Report'>) {
  const { api, t } = useApp();
  const repo = useMemo(() => new ReportRepository(api), [api]);
  const care = useMemo(() => new SessionRepository(api), [api]);
  const { sessionId, bookingId } = route.params;
  const remote = useRemote(
    useCallback(
      async () => ({
        report: await repo.find(bookingId, sessionId),
        session: await care.session(sessionId),
      }),
      [repo, care, bookingId, sessionId],
    ),
  );
  const [editing, setReport] = useState<Report>();
  const report = editing ?? remote.data?.report ?? emptyReport(sessionId);
  const [baseline, setBaseline] = useState<string>();
  const initialized = !!remote.data;
  const write = useWrite();
  const picker = useWrite();
  const [pendingPhotos, setPendingPhotos] = useState<ReportPhotoInput[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [reviewPhotos, setReviewPhotos] = useState(false);
  const operation = useRef<'save' | 'upload' | 'submit' | 'saved' | 'remove' | undefined>(
    undefined,
  );
  const dirty =
    signature(report) !== (baseline ?? signature(remote.data?.report ?? emptyReport(sessionId)));
  useDirty(dirty || pendingPhotos.length > 0, write.busy || picker.busy);
  const apply = useCallback((value: Report) => {
    setReport(value);
    setBaseline(signature(value));
  }, []);
  async function reconcile() {
    const value = await remote.reload();
    if (value) {
      const fresh = value.report ?? emptyReport(sessionId);
      if (fresh.status === 'SUBMITTED') {
        apply(fresh);
        setPendingPhotos([]);
        setReviewPhotos(false);
      } else {
        setReport(
          dirty
            ? {
                ...fresh,
                overallCondition: report.overallCondition,
                ...Object.fromEntries(reportFields.map((key) => [key, report[key]])),
              }
            : fresh,
        );
        setBaseline(signature(fresh));
        if (write.uncertain && operation.current === 'upload') setReviewPhotos(true);
      }
      write.reset();
      operation.current = undefined;
    }
  }
  const submitted = report.status === 'SUBMITTED';
  const locked = submitted || write.busy || write.uncertain || picker.busy || remote.loading;
  const needsPhotoReview = reviewPhotos && pendingPhotos.length > 0;
  async function persist() {
    operation.current = 'save';
    return repo.saveWithPhotos(report, pendingPhotos, (value, uploaded) => {
      apply(value);
      operation.current = !uploaded && pendingPhotos.length ? 'upload' : 'saved';
      if (uploaded) setPendingPhotos([]);
    });
  }
  async function save() {
    if (locked || needsPhotoReview) return;
    await write.run(persist);
  }
  async function submit() {
    if (locked || needsPhotoReview) return;
    if (!(await confirm(t('submitQuestion'), t('submitHint'), t('submit'), t('cancel')))) return;
    await write.run(
      async () => {
        const saved = await persist();
        operation.current = 'submit';
        return repo.submit(saved.id);
      },
      (value) => apply(value),
    );
  }
  async function photos() {
    setPhotoError('');
    await picker.run(async () => {
      const picked = await pickDocuments({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        multiple: true,
      });
      if (picked.canceled) return undefined;
      const combined = [
        ...new Map([...pendingPhotos, ...picked.assets].map((f) => [f.uri, f])).values(),
      ];
      try {
        repo.validatePhotos(combined, report.photos.length);
      } catch {
        setPhotoError(t('invalidReportPhotos'));
        return;
      }
      setPendingPhotos(combined);
    });
  }
  return (
    <Screen>
      <Title>{t('report')}</Title>
      <Txt muted>{t('reportHint')}</Txt>
      <RemoteState {...remote} loading={remote.loading && !remote.data} retry={remote.reload}>
        {initialized && (
          <>
            <Badge status={report.status} />
            {submitted ? (
              <Section title={t('submitted')} icon="check-circle">
                <Txt>{t(report.overallCondition)}</Txt>
                {reportFields.map((key) =>
                  report[key] ? (
                    <View key={key} style={{ gap: 4 }}>
                      <Txt muted>{t(key)}</Txt>
                      <Txt>{report[key]}</Txt>
                    </View>
                  ) : null,
                )}
              </Section>
            ) : (
              <>
                <Section title={t('overallCondition')} icon="activity">
                  <Chips
                    values={conditions.map((value) => ({ value, label: t(value) }))}
                    value={report.overallCondition}
                    onChange={(value) => {
                      if (!locked) setReport({ ...report, overallCondition: value });
                    }}
                  />
                  {!report.overallCondition && <Txt muted>{t('chooseCondition')}</Txt>}
                </Section>
                <Section title={t('reportContent')} icon="file-text">
                  {(['summary', 'recommendations'] as const).map((key) => (
                    <Field
                      key={key}
                      label={t(key)}
                      value={report[key]}
                      editable={!locked}
                      onChangeText={(value) => setReport({ ...report, [key]: value })}
                      multiline
                      maxLength={key === 'summary' ? 4000 : 2000}
                      style={{ minHeight: key === 'summary' ? 132 : 88 }}
                    />
                  ))}
                </Section>
              </>
            )}
            <Section title={t('photos')} icon="image">
              <Txt muted>{t('photoHint')}</Txt>
              <Txt muted>{`${report.photos.length + pendingPhotos.length}/5`}</Txt>
              {report.photos.map((photo) => (
                <View key={photo.id} style={{ gap: 10 }}>
                  {photo.url.startsWith('https://') && (
                    <>
                      <Button
                        kind="secondary"
                        label={t('viewFile')}
                        onPress={() => void Linking.openURL(photo.url)}
                      />
                    </>
                  )}
                  {!submitted && (
                    <Button
                      kind="danger"
                      label={t('remove')}
                      disabled={locked || dirty}
                      onPress={() =>
                        void write.run(
                          async () => {
                            operation.current = 'remove';
                            await repo.remove(report.id, photo.id);
                            const fresh = await repo.find(bookingId, sessionId);
                            if (!fresh) throw new Error('Report disappeared');
                            return fresh;
                          },
                          (value) => apply(value),
                        )
                      }
                    />
                  )}
                </View>
              ))}
              {pendingPhotos.map((photo) => (
                <View key={photo.uri} style={{ gap: 6 }}>
                  <Txt>{photo.name}</Txt>
                  <Txt muted>{t('photoPending')}</Txt>
                  <Button
                    kind="secondary"
                    label={`${t('removePendingPhoto')}: ${photo.name}`}
                    disabled={locked}
                    onPress={() => {
                      const remaining = pendingPhotos.filter((f) => f.uri !== photo.uri);
                      setPendingPhotos(remaining);
                      if (!remaining.length) setReviewPhotos(false);
                      setPhotoError('');
                    }}
                  />
                </View>
              ))}
              {needsPhotoReview && (
                <Txt style={{ color: colors.danger }}>{t('reviewReportPhotos')}</Txt>
              )}
              {!!photoError && <Txt style={{ color: colors.danger }}>{photoError}</Txt>}
              <ErrorBox error={picker.error} />
              {!submitted && (
                <Button
                  kind="secondary"
                  label={t('addPhotos')}
                  disabled={
                    locked || needsPhotoReview || report.photos.length + pendingPhotos.length >= 5
                  }
                  onPress={() => void photos()}
                />
              )}
            </Section>
            <ErrorBox error={write.error} retry={reconcile} />
            {!submitted && (
              <>
                <Button
                  label={t('saveDraft')}
                  disabled={
                    locked || needsPhotoReview || !report.overallCondition || !report.summary.trim()
                  }
                  loading={write.busy}
                  onPress={() => void save()}
                />
                {remote.data?.session.status !== 'ENDED' && <Txt muted>{t('endFirst')}</Txt>}
                <Button
                  label={t('submit')}
                  disabled={
                    locked ||
                    needsPhotoReview ||
                    !report.overallCondition ||
                    !report.summary.trim() ||
                    remote.data?.session.status !== 'ENDED'
                  }
                  loading={write.busy}
                  onPress={() => void submit()}
                />
              </>
            )}
          </>
        )}
      </RemoteState>
    </Screen>
  );
}
