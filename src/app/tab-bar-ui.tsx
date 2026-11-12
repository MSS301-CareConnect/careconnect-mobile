import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@react-native-vector-icons/feather/static';
import { colors } from '../core/ui';

export function RoundedTabButton(props: BottomTabBarButtonProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={props['aria-label'] ?? props.accessibilityLabel}
      accessibilityState={{
        ...props.accessibilityState,
        selected: props['aria-selected'] === true,
        disabled: props.disabled,
      }}
      accessibilityLargeContentTitle={props.accessibilityLargeContentTitle}
      accessibilityShowsLargeContentViewer={props.accessibilityShowsLargeContentViewer}
      disabled={props.disabled}
      testID={props.testID}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      onLayout={props.onLayout}
      android_ripple={{ color: colors.line, borderless: false }}
      style={({ pressed }) => [props.style, styles.button, pressed && styles.pressed]}
    >
      {props.children}
    </Pressable>
  );
}

export function CalendarTabIcon({
  color,
  size,
  focused,
  singleDay = false,
}: {
  color: string;
  size: number;
  focused: boolean;
  singleDay?: boolean;
}) {
  const dotSize = size * 0.07;
  return (
    <View
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.calendarBody,
          {
            left: size * 0.14,
            right: size * 0.14,
            top: size * 0.38,
            bottom: size * 0.12,
            backgroundColor: focused ? color : 'transparent',
            gap: dotSize,
          },
          singleDay && {
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            paddingTop: size * 0.08,
            paddingLeft: size * 0.15,
          },
        ]}
      >
        {singleDay ? (
          <View
            style={{
              width: size * 0.21,
              height: size * 0.21,
              borderRadius: size * 0.025,
              backgroundColor: focused ? colors.white : color,
            }}
          />
        ) : (
          [0, 1, 2].map((row) => (
            <View key={row} style={[styles.days, { gap: dotSize }]}>
              {[0, 1, 2].map((column) => (
                <View
                  key={column}
                  style={{
                    width: dotSize,
                    height: dotSize,
                    borderRadius: dotSize / 4,
                    backgroundColor: focused ? colors.white : color,
                  }}
                />
              ))}
            </View>
          ))
        )}
      </View>
      <Feather name="calendar" size={size} color={color} accessible={false} />
    </View>
  );
}

export function ToolbarTabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: 'today' | 'clipboard' | 'calendar' | 'user';
  color: string;
  size: number;
  focused: boolean;
}) {
  if (name === 'today' || name === 'calendar')
    return (
      <CalendarTabIcon color={color} size={size} focused={focused} singleDay={name === 'today'} />
    );
  if (!focused) return <Feather name={name} color={color} size={size} accessible={false} />;
  return (
    <View
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {name === 'clipboard' && (
        <>
          <View
            style={{
              position: 'absolute',
              top: size * 0.19,
              bottom: size * 0.1,
              left: size * 0.19,
              right: size * 0.19,
              backgroundColor: color,
              borderRadius: size * 0.06,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.1,
              height: size * 0.16,
              left: size * 0.36,
              right: size * 0.36,
              backgroundColor: colors.white,
              borderRadius: size * 0.04,
            }}
          />
          {[0.43, 0.59, 0.75].map((top) => (
            <View
              key={top}
              style={{
                position: 'absolute',
                top: size * top,
                height: size * 0.055,
                left: size * 0.33,
                right: size * 0.33,
                backgroundColor: colors.white,
                borderRadius: 1,
              }}
            />
          ))}
        </>
      )}
      {name === 'user' && (
        <>
          <View
            style={{
              position: 'absolute',
              top: size * 0.1,
              width: size * 0.32,
              height: size * 0.32,
              left: size * 0.34,
              backgroundColor: color,
              borderRadius: size * 0.16,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.1,
              height: size * 0.32,
              left: size * 0.16,
              right: size * 0.16,
              backgroundColor: color,
              borderTopLeftRadius: size * 0.18,
              borderTopRightRadius: size * 0.18,
              borderBottomLeftRadius: size * 0.03,
              borderBottomRightRadius: size * 0.03,
            }}
          />
        </>
      )}
      <Feather name={name} size={size} color={color} accessible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  calendarBody: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 1,
  },
  days: { flexDirection: 'row' },
});
