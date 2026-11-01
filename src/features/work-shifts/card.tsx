import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { formatInstant } from '../../core/time';
import { Badge, Info, Row, Txt, colors } from '../../core/ui';
import { Registration, WorkShift } from './models';

const styles = StyleSheet.create({
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexGrow: 1,
    flexShrink: 1,
  },
  date: { fontSize: 14, fontWeight: '700', color: colors.primary, flexShrink: 1 },
  time: { flexGrow: 1, fontSize: 25, lineHeight: 33, fontWeight: '800' },
  metadata: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  metadataText: { fontSize: 13, flexShrink: 1 },
});

export function RegistrationStatus({ registration }: { registration: Registration }) {
  return (
    <Badge
      status={
        ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(registration.status)
          ? `registration_${registration.status}`
          : registration.status
      }
    />
  );
}
export function ShiftSummary({
  shift,
  details = false,
  headerAction,
  action,
}: {
  shift: WorkShift;
  details?: boolean;
  headerAction?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { t, locale } = useApp();
  const date = formatInstant(`${shift.workDate}T00:00:00+07:00`, locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  return (
    <>
      <Row>
        <View style={styles.dateContainer}>
          <Feather name="calendar" size={15} color={colors.primary} accessible={false} />
          <Txt style={styles.date}>{date}</Txt>
        </View>
        {headerAction}
      </Row>
      <Row>
        <Txt style={styles.time}>
          {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}
        </Txt>
        {action}
      </Row>
      <Row>
        <View style={styles.metadata}>
          <Feather name="repeat" size={14} color={colors.muted} accessible={false} />
          <Txt muted style={styles.metadataText}>
            {['DAILY', 'WEEKLY'].includes(shift.shiftType)
              ? t(`workShiftType_${shift.shiftType}`)
              : shift.shiftType || t('workShift')}
          </Txt>
        </View>
        <View style={styles.metadata}>
          <Feather name="users" size={14} color={colors.muted} accessible={false} />
          <Txt muted style={styles.metadataText}>
            {t('workShiftCapacity')} {shift.approvedCount}/{shift.capacity}
          </Txt>
        </View>
      </Row>
      {shift.registrationDeadline !== '' && (
        <View style={styles.metadata}>
          <Feather name="clock" size={14} color={colors.muted} accessible={false} />
          <Txt muted style={styles.metadataText}>
            {t('workShiftDeadline')}:{' '}
            {formatInstant(shift.registrationDeadline, locale, {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Ho_Chi_Minh',
            })}
          </Txt>
        </View>
      )}
      {details && (
        <>
          <Info label={t('center')} value={shift.centerName} />
          <Badge
            status={
              ['OPEN', 'CLOSED', 'CANCELLED', 'COMPLETED', 'DRAFT'].includes(shift.status)
                ? `workShift_${shift.status}`
                : shift.status
            }
          />
        </>
      )}
    </>
  );
}
