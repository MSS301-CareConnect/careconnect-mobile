import React, { useCallback, useState } from 'react';
import { Linking, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { useReducedMotion } from '../../core/accessibility';
import { ApiError } from '../../core/api';
import { useRemote } from '../../core/hooks';
import { formatInstant } from '../../core/time';
import {
  Button,
  Card,
  ErrorBox,
  IconButton,
  RemoteState,
  Screen,
  Txt,
  colors,
} from '../../core/ui';
import { Visit } from './models';
import { RecipientProfile, RecipientSnapshot } from './recipient-models';
import { VisitRepository } from './repository';
import { AddressActions } from './address-actions';

type Icon = React.ComponentProps<typeof Feather>['name'];
type Translate = (key: string) => string;
const callable = (phone: string) => /^\+?[\d\s-]{9,16}$/.test(phone);
const dateLabel = (date: string) => (date ? date.split('-').reverse().join('/') : '');
function enumLabel(t: Translate, prefix: string, value: string) {
  const key = prefix + value;
  const label = t(key);
  return label === key ? value : label;
}

function Heading({ icon, children }: { icon: Icon; children: React.ReactNode }) {
  return (
    <View style={styles.heading}>
      <Feather name={icon} size={20} color={colors.primary} accessible={false} />
      <Txt accessibilityRole="header" style={styles.sectionTitle}>
        {children}
      </Txt>
    </View>
  );
}
function Fact({
  label,
  value,
  compact = false,
}: {
  label: string;
  value?: string;
  compact?: boolean;
}) {
  const { t } = useApp();
  return (
    <View style={compact ? styles.fact : styles.note}>
      <Txt muted style={styles.caption}>
        {label}
      </Txt>
      <Txt style={styles.value}>{value || t('recipientNotProvided')}</Txt>
    </View>
  );
}
function Note({
  label,
  value,
  icon,
  maxLines,
}: {
  label: string;
  value?: string;
  icon?: Icon;
  maxLines?: number;
}) {
  const { t } = useApp();
  return (
    <View style={styles.note}>
      {icon ? (
        <Heading icon={icon}>{label}</Heading>
      ) : (
        <Txt muted style={styles.bold}>
          {label}
        </Txt>
      )}
      <Txt numberOfLines={maxLines}>{value || t('recipientNotProvided')}</Txt>
    </View>
  );
}
function Identity({ snapshot }: { snapshot: RecipientSnapshot }) {
  const { t } = useApp();
  const initials = snapshot.name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((v) => v[0])
    .join('')
    .toUpperCase();
  return (
    <View style={styles.identity}>
      <View
        style={styles.avatar}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Txt style={styles.initials}>{initials}</Txt>
      </View>
      <View style={styles.grow}>
        <Txt muted style={styles.caption}>
          {t('patient')}
        </Txt>
        <Txt accessibilityRole="header" style={styles.name}>
          {snapshot.name || t('patient')}
        </Txt>
        <Txt muted>
          {[
            snapshot.age === undefined ? '' : `${snapshot.age} ${t('recipientYearsOld')}`,
            snapshot.gender ? t(snapshot.gender) : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Txt>
      </View>
    </View>
  );
}
function Allergy({ value }: { value: string }) {
  const { t } = useApp();
  if (!value) return null;
  return (
    <View style={styles.allergy}>
      <Feather name="alert-triangle" size={20} color={colors.danger} accessible={false} />
      <View style={styles.grow}>
        <Txt style={styles.dangerTitle}>{t('allergies')}</Txt>
        <Txt style={styles.dangerText}>{value}</Txt>
      </View>
    </View>
  );
}
function Levels({ snapshot }: { snapshot: RecipientSnapshot }) {
  const { t } = useApp();
  const levels = [
    snapshot.mobilityLevel && enumLabel(t, 'recipientMobility_', snapshot.mobilityLevel),
    snapshot.independenceLevel &&
      enumLabel(t, 'recipientIndependence_', snapshot.independenceLevel),
  ].filter(Boolean);
  return levels.length ? (
    <View style={styles.levels}>
      {levels.map((value, i) => (
        <View key={i} style={styles.level}>
          <Txt style={styles.levelText}>{value}</Txt>
        </View>
      ))}
    </View>
  ) : null;
}

export function RecipientCard({ visit, repo }: { visit: Visit; repo: VisitRepository }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const snapshot = visit.snapshot;
  const recipientId = visit.recipientId || snapshot?.recipientId;
  const notes = (key: string) => visit.special.find((item) => item.label === key)?.value;
  const times = [
    ...new Set(snapshot?.medications.flatMap((m) => m.times.map((time) => time.slice(0, 5))) ?? []),
  ].sort();
  return (
    <Card>
      {snapshot ? (
        <>
          <Identity snapshot={{ ...snapshot, name: snapshot.name || visit.name }} />
          <View style={styles.facts}>
            <Fact compact label={t('dateOfBirth')} value={dateLabel(snapshot.dateOfBirth)} />
            <Fact
              compact
              label={t('bloodType')}
              value={
                snapshot.bloodType === 'UNKNOWN' ? t('recipientUnknownBlood') : snapshot.bloodType
              }
            />
          </View>
          <Allergy value={snapshot.allergies || notes('allergies') || ''} />
          <Levels snapshot={snapshot} />
          {!!(snapshot.chronicConditions || notes('chronicConditions')) && (
            <View style={styles.brief}>
              <Note
                icon="activity"
                maxLines={recipientId ? 3 : undefined}
                label={t('chronicConditions')}
                value={snapshot.chronicConditions || notes('chronicConditions')}
              />
            </View>
          )}
          {snapshot.medications.length > 0 && (
            <View style={styles.brief}>
              <Heading icon="package">
                {snapshot.medications.length} {t('recipientMedicationCount')}
              </Heading>
              <Txt muted>
                {t('recipientMedicationTimes')}: {times.join(', ') || t('recipientNotProvided')}
              </Txt>
              {!!recipientId && (
                <Button
                  kind="secondary"
                  label={t('recipientViewMedications')}
                  onPress={() => setOpen(true)}
                />
              )}
            </View>
          )}
          {!!(snapshot.careRequirements || notes('careRequirements')) && (
            <View style={styles.brief}>
              <Note
                icon="clipboard"
                maxLines={recipientId ? 3 : undefined}
                label={t('recipientCareNotes')}
                value={snapshot.careRequirements || notes('careRequirements')}
              />
            </View>
          )}
          {!!recipientId && (
            <Button
              kind="secondary"
              icon="file-text"
              label={t('recipientFullProfile')}
              onPress={() => setOpen(true)}
            />
          )}
        </>
      ) : (
        <>
          <Heading icon="user">{t('patient')}</Heading>
          <Txt muted>{t('patientHidden')}</Txt>
        </>
      )}
      {open && recipientId && snapshot && (
        <ProfileModal recipientId={recipientId} repo={repo} onClose={() => setOpen(false)} />
      )}
    </Card>
  );
}

function ProfileModal({
  recipientId,
  repo,
  onClose,
}: {
  recipientId: string;
  repo: VisitRepository;
  onClose: () => void;
}) {
  const { t, locale } = useApp();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const remote = useRemote(
    useCallback(() => repo.recipientProfile(recipientId), [repo, recipientId]),
  );
  const denied = remote.error instanceof ApiError && [403, 404].includes(remote.error.status);
  return (
    <Modal visible animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <SafeAreaView style={styles.modal} edges={['top', 'left', 'right']}>
        <View style={[styles.modalHeader, width >= 600 ? styles.wideGutters : styles.phoneGutters]}>
          <View style={styles.grow}>
            <Txt accessibilityRole="header" style={styles.modalTitle}>
              {t('recipientProfileTitle')}
            </Txt>
          </View>
          <IconButton icon="x" label={t('close')} onPress={onClose} />
        </View>
        <Screen>
          <Txt muted>{t('recipientProfileDescription')}</Txt>
          {denied ? (
            <ErrorBox
              error={remote.error}
              messageKey="recipientProfileDenied"
              retry={remote.reload}
            />
          ) : (
            <RemoteState {...remote} retry={remote.reload}>
              {remote.data && <ProfileBody profile={remote.data} />}
              {remote.data?.snapshot.snapshotAt && (
                <Txt muted style={styles.caption}>
                  {t('recipientSnapshotAt')}:{' '}
                  {formatInstant(remote.data.snapshot.snapshotAt, locale)}
                </Txt>
              )}
            </RemoteState>
          )}
        </Screen>
      </SafeAreaView>
    </Modal>
  );
}

function ProfileBody({ profile }: { profile: RecipientProfile }) {
  const { t } = useApp();
  const { snapshot: s } = profile;
  const medications = [...s.medications].sort((a, b) =>
    (a.times[0] || '99:99').localeCompare(b.times[0] || '99:99'),
  );
  return (
    <>
      <Card>
        <Identity snapshot={s} />
        <Allergy value={s.allergies} />
        <View style={styles.facts}>
          <Fact compact label={t('dateOfBirth')} value={dateLabel(s.dateOfBirth)} />
          <Fact
            compact
            label={t('bloodType')}
            value={s.bloodType === 'UNKNOWN' ? t('recipientUnknownBlood') : s.bloodType}
          />
          <Fact
            compact
            label={t('recipientHeight')}
            value={profile.heightCm === undefined ? '' : `${profile.heightCm} cm`}
          />
          <Fact
            compact
            label={t('recipientWeight')}
            value={profile.weightKg === undefined ? '' : `${profile.weightKg} kg`}
          />
        </View>
        <Fact label={t('recipientPhone')} value={s.phone} />
        {callable(s.phone) && (
          <Button
            kind="secondary"
            icon="phone"
            label={`${t('call')}: ${s.phone}`}
            onPress={() => Linking.openURL('tel:' + s.phone)}
          />
        )}
        <Fact label={t('recipientAddress')} value={s.address} />
        <AddressActions key={s.address} address={s.address} />
      </Card>
      <Card>
        <Heading icon="activity">{t('recipientHealth')}</Heading>
        <Note label={t('chronicConditions')} value={s.chronicConditions} />
        <Note label={t('recipientMedicalHistory')} value={profile.medicalHistory} />
      </Card>
      <Card>
        <Heading icon="phone-call">
          {t('emergency')} · {profile.contacts.length}
        </Heading>
        {profile.contacts.length ? (
          profile.contacts.map((c, i) => (
            <View key={i} style={styles.listItem}>
              <Txt style={styles.bold}>{c.name || t('recipientNotProvided')}</Txt>
              {c.primary && <Txt style={styles.primaryContact}>{t('recipientPrimaryContact')}</Txt>}
              <Txt muted>
                {[c.relationship, c.phone].filter(Boolean).join(' · ') || t('recipientNotProvided')}
              </Txt>
              {callable(c.phone) && (
                <Button
                  kind="secondary"
                  icon="phone"
                  label={`${t('call')}: ${c.name || c.phone}`}
                  onPress={() => Linking.openURL('tel:' + c.phone)}
                />
              )}
            </View>
          ))
        ) : (
          <Txt muted>{t('recipientNoContacts')}</Txt>
        )}
      </Card>
      <Card>
        <Heading icon="package">
          {t('medication')} · {medications.length}
        </Heading>
        {medications.length ? (
          medications.map((m, i) => (
            <View key={i} style={styles.listItem}>
              <Txt style={styles.bold}>{m.name || t('recipientNotProvided')}</Txt>
              <Txt style={styles.primaryContact}>
                {t('recipientMedicationTimes')}:{' '}
                {m.times.map((time) => time.slice(0, 5)).join(', ') || t('recipientNotProvided')}
              </Txt>
              <Txt muted>
                {[m.dosage, m.route && enumLabel(t, 'recipientRoute_', m.route), m.frequency]
                  .filter(Boolean)
                  .join(' · ') || t('recipientNotProvided')}
              </Txt>
              {!!m.notes && <Txt>{m.notes}</Txt>}
              {!!m.startDate && (
                <Txt muted>
                  {t('recipientMedicationStart')}: {dateLabel(m.startDate)}
                </Txt>
              )}
              {!!m.endDate && (
                <Txt muted>
                  {t('recipientMedicationEnd')}: {dateLabel(m.endDate)}
                </Txt>
              )}
              {!!m.prescribedBy && (
                <Txt muted>
                  {t('recipientPrescribedBy')}: {m.prescribedBy}
                </Txt>
              )}
            </View>
          ))
        ) : (
          <Txt muted>{t('recipientNoMedications')}</Txt>
        )}
      </Card>
      <Card>
        <Heading icon="sun">{t('recipientDailyLife')}</Heading>
        <Levels snapshot={s} />
        <View style={styles.brief}>
          <Note icon="coffee" label={t('dietaryNotes')} value={s.dietaryNotes} />
        </View>
        <View style={styles.brief}>
          <Note icon="moon" label={t('recipientSleepHabits')} value={profile.sleepHabits} />
        </View>
        <View style={styles.brief}>
          <Note icon="smile" label={t('behaviorNotes')} value={s.behaviorNotes} />
        </View>
        <View style={styles.brief}>
          <Note icon="clipboard" label={t('recipientCareNotes')} value={s.careRequirements} />
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  phoneGutters: { paddingHorizontal: 16 },
  wideGutters: { paddingHorizontal: 24 },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  grow: { flex: 1, minWidth: 0 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.primary, fontWeight: '700' },
  name: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700', flexShrink: 1 },
  caption: { fontSize: 13, lineHeight: 20 },
  bold: { fontWeight: '700' },
  value: { fontWeight: '600' },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  fact: { flexGrow: 1, flexBasis: '42%', minWidth: 112, gap: 4 },
  note: { gap: 8 },
  brief: { padding: 12, borderRadius: 12, backgroundColor: colors.surfaceMuted, gap: 8 },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  level: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.pale,
    maxWidth: '100%',
  },
  levelText: { color: colors.primary, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  allergy: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  dangerTitle: { fontWeight: '700', color: colors.danger },
  dangerText: { color: colors.danger },
  listItem: { gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  primaryContact: { color: colors.primary, fontWeight: '600' },
});
