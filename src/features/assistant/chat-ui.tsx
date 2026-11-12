import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather/static';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../core/app-context';
import { Txt, colors } from '../../core/ui';

export const chatColors = {
  forest: '#0C2B25',
  mint: '#B4E7D3',
  wash: '#EFFAF5',
  canvas: '#F8FCFA',
  outline: '#D7E6DF',
  peach: '#FDB088',
};

export function ChatIcon({
  name,
  label,
  onPress,
  disabled,
  dark,
  filled,
  busy,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  dark?: boolean;
  filled?: boolean;
  busy?: boolean;
}) {
  const color = dark || filled ? chatColors.mint : chatColors.forest;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled}
      onPress={() => {
        onPress();
      }}
      style={({ pressed }) => [
        styles.icon,
        filled && styles.filledIcon,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <Feather name={name} size={20} color={color} accessible={false} />
      )}
    </Pressable>
  );
}

function RobotGlyph({ color }: { color: string }) {
  const fill = { backgroundColor: color };
  return (
    <View style={styles.robot} importantForAccessibility="no-hide-descendants">
      <View style={[styles.antennaTip, fill]} />
      <View style={[styles.antenna, fill]} />
      <View style={[styles.ear, styles.leftEar, fill]} />
      <View style={[styles.ear, styles.rightEar, fill]} />
      <View style={[styles.robotHead, { borderColor: color }]}>
        <View style={styles.eyes}>
          <View style={[styles.eye, fill]} />
          <View style={[styles.eye, fill]} />
        </View>
        <View style={[styles.mouth, fill]} />
      </View>
    </View>
  );
}

export function AssistantLauncher({ onPress }: { onPress: () => void }) {
  const { t } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('assistantOpen')}
      onPress={onPress}
      style={({ pressed }) => [styles.icon, styles.filledIcon, pressed && styles.pressed]}
    >
      <View style={styles.launcherMark} importantForAccessibility="no-hide-descendants">
        <RobotGlyph color={chatColors.forest} />
      </View>
      <View style={styles.launcherAccent} importantForAccessibility="no" />
    </Pressable>
  );
}

function AssistantMark({ large = false }: { large?: boolean }) {
  return (
    <View
      style={[styles.mark, large && styles.headerMark]}
      importantForAccessibility="no-hide-descendants"
    >
      <RobotGlyph color={large ? chatColors.forest : chatColors.mint} />
    </View>
  );
}

export function ChatHeader({
  history,
  title,
  locked,
  onHistory,
  onNew,
  onClose,
}: {
  history: boolean;
  title?: string;
  locked: boolean;
  onHistory: () => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const { t } = useApp();
  const { width, fontScale } = useWindowDimensions();
  const stackActions = width < 350 || fontScale >= 1.25;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.header}>
      <View style={[styles.headerInner, stackActions && styles.headerStack]}>
        <View style={styles.brand}>
          <AssistantMark large />
          <View style={styles.brandText}>
            <Txt accessibilityRole="header" numberOfLines={2} style={styles.title}>
              {t(history ? 'assistantHistory' : 'assistantName')}
            </Txt>
            {!history && (
              <Txt numberOfLines={1} style={styles.subtitle}>
                {title || t('assistantSubtitle')}
              </Txt>
            )}
          </View>
        </View>
        <View style={styles.actions}>
          <ChatIcon
            name={history ? 'message-circle' : 'clock'}
            label={t(history ? 'assistantBackToChat' : 'assistantHistory')}
            dark
            disabled={locked}
            onPress={onHistory}
          />
          <ChatIcon
            name="plus-square"
            label={t('assistantNew')}
            dark
            disabled={locked}
            onPress={onNew}
          />
          <ChatIcon name="x" label={t('assistantClose')} dark disabled={locked} onPress={onClose} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export function ChatBubble({
  mine = false,
  children,
}: {
  mine?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.bubbleRow, mine && styles.mineRow]}>
      {!mine && <AssistantMark />}
      <View style={[styles.bubble, mine && styles.mineBubble]}>{children}</View>
    </View>
  );
}

export function ChatText({
  content,
  mine = false,
  plain = false,
}: {
  content: string;
  mine?: boolean;
  plain?: boolean;
}) {
  const { t } = useApp();
  const author = t(mine ? 'assistantYou' : 'assistantAuthor');
  if (mine || plain)
    return (
      <Txt selectable accessibilityLabel={author + ', ' + content} style={mine && styles.mineText}>
        {content}
      </Txt>
    );
  return (
    <View style={styles.paragraphs}>
      {content
        .trim()
        .split(/\r?\n\s*\r?\n/)
        .map((block, i) => (
          <Txt selectable key={i} accessibilityLabel={i === 0 ? author + ', ' + block : undefined}>
            {block.split(/\r?\n/).map((line, j) => {
              const heading = /^\s*#{1,6}\s+/.test(line);
              const value = line.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*[-*•]\s+/, '• ');
              return (
                <Text key={j} style={heading && styles.bold}>
                  {j > 0 && '\n'}
                  {value.split(/(\*\*[^*]+\*\*)/).map((part, k) =>
                    k % 2 === 1 ? (
                      <Text key={k} style={styles.bold}>
                        {part.slice(2, -2)}
                      </Text>
                    ) : (
                      part
                    ),
                  )}
                </Text>
              );
            })}
          </Txt>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  filledIcon: { backgroundColor: chatColors.forest },
  launcherMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: chatColors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launcherAccent: {
    position: 'absolute',
    right: 1,
    top: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: chatColors.forest,
    backgroundColor: chatColors.peach,
  },
  robot: { width: 22, height: 22 },
  antennaTip: { position: 'absolute', top: 1, left: 9, width: 4, height: 4, borderRadius: 2 },
  antenna: { position: 'absolute', top: 3, left: 10, width: 2, height: 4 },
  ear: { position: 'absolute', top: 10, width: 3, height: 5, borderRadius: 1 },
  leftEar: { left: 1 },
  rightEar: { right: 1 },
  robotHead: {
    position: 'absolute',
    top: 6,
    left: 4,
    width: 14,
    height: 13,
    borderWidth: 2,
    borderRadius: 3,
  },
  eyes: {
    position: 'absolute',
    top: 2,
    left: 1,
    right: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eye: { width: 2, height: 2, borderRadius: 1 },
  mouth: { position: 'absolute', bottom: 2, left: 2, right: 2, height: 1.5, borderRadius: 1 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  header: { backgroundColor: chatColors.forest },
  headerInner: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 4,
  },
  headerStack: { flexDirection: 'column', alignItems: 'stretch' },
  brand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandText: { flex: 1, minWidth: 0 },
  title: { color: colors.white, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  subtitle: { color: '#CAE1D8', fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', alignSelf: 'flex-end', gap: 4 },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chatColors.forest,
  },
  headerMark: { width: 44, height: 44, borderRadius: 22, backgroundColor: chatColors.mint },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  mineRow: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '84%',
    gap: 8,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderColor: chatColors.outline,
    borderWidth: 1,
  },
  mineBubble: {
    backgroundColor: chatColors.forest,
    borderColor: chatColors.forest,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 6,
  },
  mineText: { color: colors.white },
  bold: { fontWeight: '700' },
  paragraphs: { gap: 8 },
});
