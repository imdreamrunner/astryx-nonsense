/**
 * Theme Disco: a dance floor of Astryx components while the whole app steps through every Astryx theme.
 *
 * - DISCO (a big library Button) moves to the next theme in the library's list; the App re-renders under the new
 *   theme and a wash in the new body colour cross-fades the change. The theme's name and description show on a glass
 *   marquee, and the change is announced.
 * - Party mode (a library Switch) changes the theme on every fourth beat of a fake 120 bpm beat; the floor tiles pulse
 *   on each beat (native driver) and each theme change plays a light `select` haptic (a moment per change, not a buzz
 *   per beat).
 * - The floor: Buttons, Badges, an AvatarGroup, a Card, a Switch, a Slider, a ProgressBar, Chips — all re-tint with the
 *   theme; spotlights sweep over them.
 * - Reduce Motion: no pulsing, no spotlights; themes only cross-fade.
 */
import React from 'react';
import {AccessibilityInfo, Animated, Easing, ScrollView, StyleSheet, View} from 'react-native';
import {
  ASTRYX_THEMES,
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Card,
  Chip,
  ChipGroup,
  Heading,
  HStack,
  MaterialSurface,
  ProgressBar,
  Slider,
  Switch,
  Text,
  useAstryx,
  useHaptics,
  VStack,
} from '@astryx-exploration/react-native';
import {useAstryxInsets} from '@astryx-exploration/react-native-navigation';
import {formatMessage} from '@astryx-exploration/react-native/i18n';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Aurora, withAlpha} from '../Aurora';
import {useDisco} from '../disco';
import {feel, tabClearance} from '../feel';
import {STRINGS} from '../strings';

/** 120 bpm. */
export const BEAT_MS = 500;
const BEATS_PER_THEME = 4;

export function DiscoScreen(): React.JSX.Element {
  const a = useAstryx();
  const haptics = useHaptics();
  const safe = useSafeAreaInsets();
  const {chrome} = useAstryxInsets();
  const {entry, next, isParty, setParty, index} = useDisco();
  const [beat] = React.useState(() => new Animated.Value(0));
  const [sweep] = React.useState(() => new Animated.Value(0));
  const [volume, setVolume] = React.useState(62);
  const [lights, setLights] = React.useState(true);
  const [genre, setGenre] = React.useState<readonly string[]>(['funk']);
  const [joined, setJoined] = React.useState(false);
  const reduced = a.isReduceMotion;

  const change = React.useCallback(() => {
    next();
    feel(haptics, 'tick');
  }, [next, haptics]);

  // Announce each new theme by name.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    AccessibilityInfo.announceForAccessibility(formatMessage(STRINGS.themeAnnouncement, {theme: entry.label}));
  }, [entry.label]);

  // Party: a beat every BEAT_MS (tiles pulse), a theme every BEATS_PER_THEME beats.
  React.useEffect(() => {
    if (!isParty) return;
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (!reduced) {
        beat.setValue(1);
        Animated.timing(beat, {toValue: 0, duration: BEAT_MS * 0.8, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false}).start();
      }
      if (count % BEATS_PER_THEME === 0) change();
    }, BEAT_MS);
    return () => clearInterval(timer);
  }, [isParty, reduced, beat, change]);

  // Spotlights sweep while the lights are on.
  React.useEffect(() => {
    if (reduced || !lights) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false}),
        Animated.timing(sweep, {toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, lights, sweep]);

  const pulse = beat.interpolate({inputRange: [0, 1], outputRange: [1, 1.06]});
  const tile = (child: React.ReactNode, key: string, delay = 0) => (
    <Animated.View key={key} style={{transform: [{scale: delay % 2 ? beat.interpolate({inputRange: [0, 1], outputRange: [1, 0.96]}) : pulse}]}}>
      {child}
    </Animated.View>
  );
  const {color, space, radius} = a.tokens;
  const beamA = sweep.interpolate({inputRange: [0, 1], outputRange: ['-35deg', '35deg']});
  const beamB = sweep.interpolate({inputRange: [0, 1], outputRange: ['30deg', '-30deg']});

  return (
    <View style={styles.fill} testID="nonsense-disco">
      <Aurora intensity={0.45} />
      {!reduced && lights ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[
            {rotate: beamA, left: '15%', tone: color.iconPink},
            {rotate: beamB, left: '70%', tone: color.iconBlue},
          ].map((beam, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                top: -space.s12,
                left: beam.left as `${number}%`,
                width: space.s12 * 2.5,
                height: '120%',
                transformOrigin: 'top',
                transform: [{rotate: beam.rotate}],
                backgroundImage: `linear-gradient(180deg, ${withAlpha(beam.tone, 0.55)} 0%, ${withAlpha(beam.tone, 0)} 85%)`,
              }}
            />
          ))}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{paddingTop: safe.top + space.s3, paddingHorizontal: space.s4, paddingBottom: tabClearance(chrome.bottom, safe.bottom) + space.s6, gap: space.s4}}>
        <VStack gap={1}>
          <Heading level={1}>{STRINGS.discoTitle}</Heading>
          <Text type="supporting" color="secondary">
            {reduced ? STRINGS.calm : STRINGS.discoHint}
          </Text>
        </VStack>
        <MaterialSurface material="material" variant="glass" fill={color.backgroundSurface} cornerRadius={radius.page} style={{borderRadius: radius.page, padding: space.s4, gap: space.s1}} accessible accessibilityLabel={formatMessage(STRINGS.nowPlaying, {theme: entry.label})} testID="nonsense-disco-marquee">
          <Text type="supporting" color="secondary">
            {formatMessage(STRINGS.nowPlaying, {theme: ''}).trim()}
          </Text>
          <Text type="display-3" weight="bold">
            {`${entry.label}  ${formatMessage(STRINGS.themePosition, {index: index + 1, count: ASTRYX_THEMES.length})}`}
          </Text>
          <Text type="supporting" color="secondary" maxLines={2}>
            {entry.description}
          </Text>
        </MaterialSurface>
        <Animated.View style={{transform: [{scale: pulse}]}}>
          <Button id="nonsense-disco-button" label={STRINGS.disco} variant="primary" size="lg" width="fill" icon="play" onClick={change} tooltip={STRINGS.discoA11y} />
        </Animated.View>
        <Card padding={4}>
          <HStack gap={3} align="center" justify="between">
            <VStack gap={0.5}>
              <Text type="label" weight="semibold">
                {STRINGS.party}
              </Text>
              <Text type="supporting" color="secondary">
                {STRINGS.partyHint}
              </Text>
            </VStack>
            <Switch id="nonsense-disco-party" label={STRINGS.party} isLabelHidden value={isParty} onChange={setParty} />
          </HStack>
        </Card>
        <View style={styles.floor}>
          {tile(<Badge label={STRINGS.badgeHot} variant="red" />, 'b1', 0)}
          {tile(<Badge label={STRINGS.badgeNew} variant="green" />, 'b2', 1)}
          {tile(<Badge label={STRINGS.badgeVip} variant="purple" />, 'b3', 0)}
          {tile(<Badge label={entry.label} variant="blue" />, 'b4', 1)}
        </View>
        {tile(
          <Card padding={4} variant="muted">
            <VStack gap={3}>
              <HStack gap={3} align="center" justify="between">
                <VStack gap={0.5}>
                  <Text type="label" weight="semibold">
                    {STRINGS.cardTitle}
                  </Text>
                  <Text type="supporting" color="secondary">
                    {STRINGS.cardBody}
                  </Text>
                </VStack>
                <Avatar name={STRINGS.cardAvatar} size="lg" />
              </HStack>
              <VStack gap={1}>
                <Text type="supporting" color="secondary">
                  {STRINGS.dancers}
                </Text>
                <AvatarGroup size="md">
                  {STRINGS.dancerNames.map(name => (
                    <Avatar key={name} name={name} />
                  ))}
                </AvatarGroup>
              </VStack>
              <ProgressBar label={STRINGS.volumeMeter} value={volume} />
              <Slider id="nonsense-disco-volume" label={STRINGS.volume} value={volume} onChange={value => setVolume(Array.isArray(value) ? value[0]! : (value as number))} min={0} max={100} />
              <HStack gap={3} align="center" justify="between">
                <Text type="label">{STRINGS.lights}</Text>
                <Switch id="nonsense-disco-lights" label={STRINGS.lights} isLabelHidden value={lights} onChange={setLights} />
              </HStack>
              <ChipGroup label={STRINGS.genre} type="single" value={genre} onChange={setGenre} layout="wrap">
                {STRINGS.genres.map(item => (
                  <Chip key={item.value} value={item.value} label={item.label} />
                ))}
              </ChipGroup>
              <HStack gap={2}>
                <Button id="nonsense-disco-join" label={joined ? STRINGS.leave : STRINGS.join} variant={joined ? 'secondary' : 'primary'} onClick={() => setJoined(j => !j)} />
                <Button id="nonsense-disco-again" label={STRINGS.disco} variant="ghost" onClick={change} />
              </HStack>
            </VStack>
          </Card>,
          'card',
          1,
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  clip: {overflow: 'hidden'},
  floor: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center'},
});
