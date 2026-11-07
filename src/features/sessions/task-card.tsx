import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useApp } from '../../core/app-context';
import { Button, Field, Txt, colors } from '../../core/ui';
import { Task } from './models';

export function SessionTaskCard({
  task,
  editable,
  locked,
  skipping,
  reason,
  onReason,
  onDone,
  onUndo,
  onSkip,
  onCancelSkip,
  onSaveSkip,
}: {
  task: Task;
  editable: boolean;
  locked: boolean;
  skipping: boolean;
  reason: string;
  onReason: (value: string) => void;
  onDone: () => void;
  onUndo: () => void;
  onSkip: () => void;
  onCancelSkip: () => void;
  onSaveSkip: () => void;
}) {
  const { t } = useApp();
  const pending = task.status === 'PENDING';
  return (
    <View style={[styles.card, task.status === 'DONE' && styles.done]}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Feather
            name={
              task.status === 'DONE'
                ? 'check-circle'
                : task.status === 'SKIPPED'
                  ? 'minus-circle'
                  : 'circle'
            }
            size={22}
            color={task.status === 'DONE' ? colors.primary : colors.muted}
            accessible={false}
          />
          <View style={styles.copy}>
            <Txt style={[styles.title, task.status === 'SKIPPED' && styles.skipped]}>
              {task.title}
            </Txt>
            <Txt muted style={styles.meta}>
              {['SERVICE', 'MEDICATION', 'CUSTOM'].includes(task.type)
                ? t(`careTask_${task.type}`)
                : t('checklist')}
              {task.scheduledTime ? ' · ' + task.scheduledTime.slice(0, 5) : ''}
              {' · ' + t(task.status)}
            </Txt>
            {!!task.skipReason && <Txt muted>{task.skipReason}</Txt>}
            {!!task.note && <Txt muted>{task.note}</Txt>}
          </View>
        </View>
        {editable && (
          <View style={styles.actions}>
            {pending ? (
              <>
                <Button label={t('careTaskDone')} disabled={locked} onPress={onDone} />
                <Button label={t('skip')} kind="secondary" disabled={locked} onPress={onSkip} />
              </>
            ) : (
              <Button label={t('undo')} kind="secondary" disabled={locked} onPress={onUndo} />
            )}
          </View>
        )}
      </View>
      {editable && skipping && (
        <View style={styles.skipForm}>
          <Field
            label={t('skipReason')}
            value={reason}
            onChangeText={onReason}
            editable={!locked}
            maxLength={500}
            multiline
          />
          <View style={styles.actions}>
            <Button label={t('save')} disabled={locked || !reason.trim()} onPress={onSaveSkip} />
            <Button label={t('cancel')} kind="secondary" disabled={locked} onPress={onCancelSkip} />
          </View>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 14, backgroundColor: colors.surfaceMuted, gap: 12 },
  done: { backgroundColor: colors.pale },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 0,
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  skipped: { textDecorationLine: 'line-through', color: colors.muted },
  meta: { fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skipForm: { gap: 12, paddingTop: 4 },
});
