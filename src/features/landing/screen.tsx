import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather/static';
import { useReducedMotion } from '../../core/accessibility';
import { useApp } from '../../core/app-context';
import { BrandMark } from '../../core/brand';
import { Button, Txt, colors } from '../../core/ui';
import { ScheduleHero } from './schedule-hero';

const schedulePanelTop = '#197751';
const walletCanvas = '#035537';
const walletPanel = '#047246';
const lightIllustrationPanel = '#045836';
const illustrations = {
  Requests: {
    vi: require('../../../assets/images/landing-requests-vi.png'),
    en: require('../../../assets/images/landing-requests-en.png'),
  },
  Care: {
    vi: require('../../../assets/images/landing-care-vi.png'),
    en: require('../../../assets/images/landing-care-en.png'),
  },
  Wallet: {
    vi: require('../../../assets/images/landing-wallet-vi.png'),
    en: require('../../../assets/images/landing-wallet-en.png'),
  },
} as const;

type Tone = 'split' | 'deep' | 'pale';
type Slide = { key: 'Welcome' | 'Schedule' | keyof typeof illustrations; tone: Tone };

const slides: readonly [Slide, ...Slide[]] = [
  { key: 'Welcome', tone: 'split' },
  { key: 'Schedule', tone: 'split' },
  { key: 'Requests', tone: 'pale' },
  { key: 'Care', tone: 'pale' },
  { key: 'Wallet', tone: 'deep' },
];

const palettes = {
  split: {
    top: colors.bg,
    panel: colors.primaryDeep,
    header: colors.ink,
    title: colors.white,
    body: colors.pale,
    dot: colors.white,
    button: 'secondary',
    bar: 'dark-content',
  },
  deep: {
    top: colors.primaryDeep,
    panel: colors.primary,
    header: colors.white,
    title: colors.white,
    body: colors.pale,
    dot: colors.white,
    button: 'secondary',
    bar: 'light-content',
  },
  pale: {
    top: colors.bg,
    panel: colors.pale,
    header: colors.ink,
    title: colors.ink,
    body: colors.muted,
    dot: colors.primary,
    button: 'primary',
    bar: 'dark-content',
  },
} as const;

function WelcomeHero({ width, height }: { width: number; height: number }) {
  const photoWidth = Math.max(width, height * 1.5);
  return (
    <View importantForAccessibility="no-hide-descendants" style={[styles.welcomeHero, { height }]}>
      <Image
        source={require('../../../assets/images/care-at-home-hero.jpg')}
        accessible={false}
        resizeMode="cover"
        fadeDuration={0}
        style={[styles.welcomePhoto, { width: photoWidth, height: photoWidth / 1.5 }]}
      />
      <View style={styles.welcomeSeal}>
        <Feather name="heart" size={22} color={colors.primaryDeep} accessible={false} />
      </View>
      <Image
        source={require('../../../assets/images/landing-welcome-ribbon.png')}
        accessible={false}
        resizeMode="stretch"
        fadeDuration={0}
        style={styles.welcomeRibbon}
      />
    </View>
  );
}

export function LandingScreen({ onDone }: { onDone: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<{ Login: undefined }>>();
  const { t, locale } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [enter] = useState(() => new Animated.Value(1));
  const last = index === slides.length - 1;
  const slide = slides[index] ?? slides[0];
  const welcome = slide.key === 'Welcome';
  const schedule = slide.key === 'Schedule';
  const lightIllustration = slide.key === 'Requests' || slide.key === 'Care';
  const wallet = slide.key === 'Wallet';
  const intro = welcome || schedule;
  const illustration =
    slide.key === 'Welcome' || slide.key === 'Schedule'
      ? undefined
      : illustrations[slide.key][locale];
  const illustrated = !intro;
  const palette = palettes[slide.tone];
  const welcomeWidth = Math.min(520, width - insets.left - insets.right);
  const welcomeHeight = Math.max(168, Math.min(welcomeWidth * 0.94, height * 0.49, 408));
  const illustrationHeight = Math.min(width - insets.left - insets.right, height * 0.56, 480);

  useEffect(() => {
    if (reducedMotion) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, reducedMotion, enter]);

  useEffect(() => {
    if (index === 0) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setIndex((current) => Math.max(0, current - 1));
      return true;
    });
    return () => subscription.remove();
  }, [index]);

  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -48) setIndex((current) => Math.min(slides.length - 1, current + 1));
          else if (gesture.dx > 48) setIndex((current) => Math.max(0, current - 1));
        },
      }),
    [],
  );

  const finish = () => {
    onDone();
    navigation.replace('Login');
  };
  const motion = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: palette.top },
        welcome && styles.welcomeRoot,
        schedule && styles.scheduleRoot,
        lightIllustration && styles.lightIllustrationRoot,
        wallet && styles.walletRoot,
      ]}
      {...swipe.panHandlers}
    >
      <StatusBar barStyle={palette.bar} />
      {welcome && (
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={styles.welcomeCorner}
        />
      )}
      <ScrollView
        bounces={false}
        overScrollMode="never"
        style={{ marginTop: insets.top }}
        contentContainerStyle={[
          styles.content,
          intro && {
            paddingLeft: insets.left + 20,
            paddingRight: insets.right + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.header,
            intro && styles.introHeader,
            illustrated && styles.illustratedHeader,
            styles.headerInset,
          ]}
        >
          {!welcome && (
            <View
              style={[styles.headerSide, (illustrated || schedule) && styles.illustratedHeaderSide]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('back')}
                onPress={() => setIndex(index - 1)}
                style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
              >
                <Feather name="arrow-left" size={24} color={palette.header} accessible={false} />
              </Pressable>
            </View>
          )}
          {welcome ? (
            <View style={styles.brandGroup}>
              <BrandMark size={32} />
              <Txt
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[styles.brand, styles.introBrand]}
              >
                {t('app')}
              </Txt>
            </View>
          ) : (
            <Txt
              numberOfLines={1}
              adjustsFontSizeToFit={illustrated || schedule}
              minimumFontScale={0.75}
              style={[
                styles.brand,
                { color: palette.header },
                (illustrated || schedule) && styles.illustratedBrand,
              ]}
            >
              {t('app')}
            </Txt>
          )}
          <View
            style={[
              !welcome && styles.headerSide,
              styles.headerEnd,
              (illustrated || schedule) && styles.illustratedHeaderSide,
            ]}
          >
            {!last && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('landingSkip')}
                onPress={finish}
                style={({ pressed }) => [
                  styles.headerButton,
                  (intro || lightIllustration) && styles.introSkip,
                  pressed && styles.pressed,
                ]}
              >
                <Txt
                  style={[
                    styles.skip,
                    { color: intro || lightIllustration ? colors.primaryDeep : palette.header },
                  ]}
                >
                  {t('landingSkip')}
                </Txt>
              </Pressable>
            )}
          </View>
        </View>
        {intro ? (
          <Animated.View
            style={[
              styles.introArt,
              welcome && [styles.welcomeArt, { width: welcomeWidth }],
              schedule && [styles.scheduleArt, { width: welcomeWidth }],
              motion,
            ]}
          >
            {welcome ? (
              <WelcomeHero width={welcomeWidth} height={welcomeHeight} />
            ) : (
              <ScheduleHero height={Math.min(welcomeWidth, height * 0.51, 440)} />
            )}
          </Animated.View>
        ) : (
          <>
            <Animated.View
              importantForAccessibility="no-hide-descendants"
              style={[styles.illustratedArt, motion]}
            >
              <Image
                source={illustration}
                accessible={false}
                resizeMode="contain"
                fadeDuration={0}
                style={[styles.illustration, { height: illustrationHeight }]}
              />
            </Animated.View>
            <View style={styles.illustratedWave} importantForAccessibility="no-hide-descendants">
              <View
                style={[styles.illustratedWaveBack, lightIllustration && styles.lightWaveBack]}
              />
              <View
                style={[styles.illustratedWaveFront, lightIllustration && styles.lightWaveFront]}
              />
            </View>
          </>
        )}
        {schedule && (
          <Image
            source={require('../../../assets/images/landing-schedule-wave.png')}
            accessible={false}
            importantForAccessibility="no"
            resizeMode="stretch"
            fadeDuration={0}
            style={[styles.scheduleWave, { width: width - insets.left - insets.right }]}
          />
        )}
        <View
          style={[
            styles.panel,
            {
              backgroundColor: intro ? palette.top : palette.panel,
              paddingBottom: insets.bottom + (intro ? 20 : 28),
            },
            intro && styles.introPanel,
            welcome && styles.welcomePanel,
            schedule && styles.schedulePanel,
            lightIllustration && styles.lightIllustrationPanel,
            wallet && styles.walletPanel,
          ]}
        >
          <Animated.View style={[styles.copy, motion]}>
            {intro && (
              <Txt style={[styles.introEyebrow, schedule && styles.scheduleEyebrow]}>
                {t(`landing${slide.key}Eyebrow`)}
              </Txt>
            )}
            <Txt
              accessibilityRole="header"
              style={[
                styles.title,
                { color: palette.title },
                intro && styles.introTitle,
                schedule && styles.scheduleTitle,
                illustrated && styles.illustratedTitle,
              ]}
            >
              {t(`landing${slide.key}Title`)}
            </Txt>
            <Txt
              style={[
                styles.body,
                { color: intro ? colors.muted : palette.body },
                schedule && styles.scheduleBody,
                illustrated && styles.illustratedBody,
              ]}
            >
              {t(`landing${slide.key}Body`)}
            </Txt>
          </Animated.View>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('landingStep')
              .replace('{current}', String(index + 1))
              .replace('{total}', String(slides.length))}
            accessibilityValue={{ min: 1, max: slides.length, now: index + 1 }}
            style={styles.dots}
          >
            {slides.map((item, position) => (
              <View
                key={item.key}
                style={[
                  styles.step,
                  {
                    backgroundColor: illustrated
                      ? colors.white
                      : intro
                        ? colors.primary
                        : palette.dot,
                  },
                  position === index ? styles.stepActive : styles.stepIdle,
                  schedule &&
                    (position === index ? styles.scheduleStepActive : styles.scheduleStep),
                ]}
              />
            ))}
          </View>
          <Button
            kind={lightIllustration ? 'secondary' : welcome ? 'primary' : palette.button}
            label={t(last ? 'landingStart' : 'continue')}
            icon={illustrated ? 'arrow-right' : undefined}
            style={[
              styles.action,
              intro && styles.introAction,
              welcome && styles.welcomeAction,
              schedule && styles.scheduleAction,
              illustrated && styles.illustratedAction,
            ]}
            onPress={last ? finish : () => setIndex(index + 1)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  welcomeRoot: {
    overflow: 'hidden',
    backgroundColor: colors.white,
    experimental_backgroundImage:
      'linear-gradient(180deg, #F5FBF6, #FFFFFF 32%, #FFFFFF 76%, #E9F7ED)',
  },
  welcomeCorner: {
    position: 'absolute',
    top: -116,
    right: -56,
    width: 268,
    height: 236,
    borderRadius: 118,
    transform: [{ rotate: '22deg' }],
    backgroundColor: '#E8F5EB',
    experimental_backgroundImage: 'linear-gradient(140deg, #D3EEDB, #F0FAF3)',
  },
  scheduleRoot: {
    backgroundColor: '#EFF6F2',
    experimental_backgroundImage: 'linear-gradient(160deg, #F2F7F4, #EDF5F0)',
  },
  walletRoot: {
    backgroundColor: walletCanvas,
    experimental_backgroundImage: 'linear-gradient(165deg, #045839, #035335)',
  },
  lightIllustrationRoot: {
    backgroundColor: '#EDF6F3',
    experimental_backgroundImage: 'linear-gradient(180deg, #ECF5F2, #EDF6F3)',
  },
  illustratedHeader: { paddingHorizontal: 12 },
  illustratedHeaderSide: { flexBasis: 0, minWidth: 48 },
  illustratedBrand: { fontSize: 20, lineHeight: 27 },
  illustratedArt: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  illustration: { width: '100%', maxWidth: 540 },
  illustratedWave: { height: 40, overflow: 'hidden' },
  illustratedWaveBack: {
    position: 'absolute',
    top: 12,
    right: 0,
    left: '46%',
    bottom: 0,
    backgroundColor: '#378462',
  },
  illustratedWaveFront: {
    width: '69%',
    height: 80,
    borderTopRightRadius: 80,
    backgroundColor: walletPanel,
  },
  lightWaveBack: { backgroundColor: '#58A884' },
  lightWaveFront: { backgroundColor: lightIllustrationPanel },
  headerInset: { paddingTop: 4 },
  content: { flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 8 },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  headerSide: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'flex-start' },
  headerEnd: { alignItems: 'flex-end' },
  headerButton: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 16, lineHeight: 24, fontWeight: '800', flexShrink: 1 },
  skip: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  pressed: { opacity: 0.65 },
  introHeader: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  introBrand: { fontSize: 19, lineHeight: 26, letterSpacing: -0.45 },
  introSkip: { backgroundColor: colors.pale, borderRadius: 24, paddingHorizontal: 14 },
  introArt: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  welcomeArt: { maxWidth: 520, paddingTop: 12, paddingBottom: 0 },
  scheduleArt: { maxWidth: 520, paddingVertical: 0 },
  welcomeHero: {
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.pale,
  },
  welcomePhoto: { position: 'absolute', top: 0, right: 0 },
  welcomeSeal: {
    position: 'absolute',
    left: 16,
    top: 16,
    width: 46,
    height: 46,
    borderRadius: 14,
    transform: [{ rotate: '-10deg' }],
    backgroundColor: colors.white,
    experimental_backgroundImage: 'linear-gradient(155deg, #FFFFFF, #DFF4E5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeRibbon: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: 68 },
  panel: { paddingHorizontal: 24, paddingTop: 12, gap: 24, alignItems: 'center' },
  introPanel: { paddingHorizontal: 0, paddingTop: 4, gap: 20 },
  welcomePanel: { backgroundColor: 'transparent', paddingTop: 8 },
  scheduleWave: { alignSelf: 'center', height: 42, marginBottom: -1 },
  schedulePanel: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: schedulePanelTop,
    experimental_backgroundImage: `linear-gradient(170deg, ${schedulePanelTop}, #064E36)`,
  },
  scheduleEyebrow: { color: '#C5F1D7' },
  scheduleTitle: { color: colors.white },
  scheduleBody: { color: '#EFFAF3' },
  scheduleStep: { backgroundColor: '#A0DDB9', opacity: 1 },
  scheduleStepActive: { backgroundColor: colors.white },
  walletPanel: {
    backgroundColor: walletPanel,
    experimental_backgroundImage: 'linear-gradient(180deg, #047246, #046641)',
  },
  lightIllustrationPanel: {
    backgroundColor: lightIllustrationPanel,
    experimental_backgroundImage: `linear-gradient(170deg, ${lightIllustrationPanel}, #064C34)`,
  },
  illustratedTitle: { fontSize: 27, lineHeight: 34, color: colors.white },
  illustratedBody: { color: '#CAEBDD', fontSize: 17, lineHeight: 24 },
  introEyebrow: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.primary },
  introTitle: { fontSize: 34, lineHeight: 41, letterSpacing: -0.75, color: colors.primaryDeep },
  copy: { gap: 12, width: '100%', maxWidth: 480 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '800', letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 24 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 16 },
  step: { height: 8, borderRadius: 4 },
  stepActive: { width: 24 },
  stepIdle: { width: 8, opacity: 0.4 },
  action: { width: '100%', maxWidth: 480, borderRadius: 24 },
  introAction: { minHeight: 56, borderRadius: 28, backgroundColor: colors.primaryDeep },
  welcomeAction: {
    experimental_backgroundImage: 'linear-gradient(105deg, #167B45, #055635)',
  },
  scheduleAction: { backgroundColor: colors.white, borderWidth: 0 },
  illustratedAction: {
    flexDirection: 'row-reverse',
    minHeight: 54,
    borderRadius: 28,
    backgroundColor: '#E5F4EB',
    borderWidth: 0,
  },
});
