/**
 * 3D Card Deck: a stack of tilted cards with absurd fortunes.
 *
 * - The top card follows the finger and pivots about it (grabbed above its centre it turns clockwise as it moves right,
 *   below it counter-clockwise), lifting a little — a flat tilt (`rotateZ`, scale), so it can never cut into the cards
 *   under it — over a fanned, stepped stack.
 * - Release (./physics): the outcome comes from where the card would be ~180 ms on (position plus velocity). Past the
 *   line to the right it is thrown off along its release velocity, falling under gravity and still spinning at its
 *   release rate, glowing as it goes (accepted, `success` haptic); to the left the same throw sends it to the back. Short
 *   of the line it springs home carrying its release velocity. The Accept / Skip buttons throw it the same way.
 * - Shuffle riffles the visible cards and deals a new order. Accept / Skip / Shuffle are buttons too (gestures are
 *   shortcuts), and the top card's accessibility actions are Accept and Skip; results are announced.
 * - Reduce Motion: no turn, no throw; the card fades out quickly and the next one is there.
 * - Native driver: every card has the same transform keys in the same order, and the top card's
 *   drag values are new for each top card, so nothing is reset under a card that is still drawn.
 */
import React from 'react';
import {AccessibilityInfo, Animated, Easing, PanResponder, StyleSheet, Text as RNText, useWindowDimensions, View} from 'react-native';
import type {HostInstance} from 'react-native';
import {Button, Heading, Text, textStyle, useAstryx, useHaptics} from '@astryx-exploration/react-native';
import {useAstryxInsets} from '@astryx-exploration/react-native-navigation';
import {formatMessage} from '@astryx-exploration/react-native/i18n';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Aurora, withAlpha} from '../Aurora';
import {feel, seeded, tabClearance} from '../feel';
import {createVelocityTracker, dragAngle, flingPlan, pivotSign, releaseOutcome} from './physics';
import type {FlingStart} from './physics';
import {STRINGS} from '../strings';

const VISIBLE = 4;
const CARD_TONES = ['iconPurple', 'iconPink', 'iconBlue', 'iconTeal', 'iconOrange', 'iconGreen'] as const;

export function DeckScreen(): React.JSX.Element {
  const a = useAstryx();
  const haptics = useHaptics();
  const safe = useSafeAreaInsets();
  const {chrome} = useAstryxInsets();
  const {width} = useWindowDimensions();
  const fortunes = STRINGS.fortunes;
  const [order, setOrder] = React.useState<number[]>(() => fortunes.map((_, index) => index));
  const [accepted, setAccepted] = React.useState(0);
  const [isBusy, setBusy] = React.useState(false);
  // The top card's values are made fresh for each top card. Resetting shared values instead moved the departing card
  // back to the centre for a frame before React re-rendered the new order (the jump people saw).
  const top = order[0]!;
  const {drag, glow, angle, fade} = React.useMemo(
    () => ({drag: new Animated.ValueXY({x: 0, y: 0}), glow: new Animated.Value(0), angle: new Animated.Value(0), fade: new Animated.Value(1)}),
    [top],
  );
  // The live drag, read back on release (Animated values are not readable synchronously on the native driver).
  const held = React.useRef({x: 0, y: 0, angle: 0, pivot: 1 as 1 | -1});
  // The release velocity from the deck's tracker over the last moves, beside PanResponder's own (which can read near
  // zero for a short, fast flick whose last events repeat the end point); the faster of the two counts.
  const [tracker] = React.useState(() => createVelocityTracker());
  React.useEffect(() => {
    held.current = {x: 0, y: 0, angle: 0, pivot: 1};
  }, [top]);
  const [riffle] = React.useState(() => new Animated.Value(0));
  const shuffleSeed = React.useRef(seeded(42));
  const reduced = a.isReduceMotion;
  const cardWidth = Math.min(width - a.tokens.space.s12 * 2, 320);
  const cardHeight = cardWidth * 1.3;
  const cardDiagonal = Math.hypot(cardWidth, cardHeight) / 2;
  // The card box's top in page coordinates, for where a grab lands on the card (the touch's own locationY is relative to
  // whichever child was touched — the fortune text, the number — not to the card).
  const box = React.useRef<HostInstance>(null);
  const boxTop = React.useRef(0);
  const measureBox = React.useCallback(() => box.current?.measure((_x, _y, _w, _h, _pageX, pageY) => (boxTop.current = pageY)), []);

  /** Throw the top card off in `direction`, from where it is held, with the release velocity; then `finish`. */
  const throwCard = React.useCallback(
    (direction: 1 | -1, start: FlingStart, finish: () => void, withGlow: boolean) => {
      if (reduced) {
        Animated.timing(fade, {toValue: 0, duration: a.tokens.motion.fast, useNativeDriver: true}).start(finish);
        return;
      }
      const plan = flingPlan(start, direction, width, cardDiagonal);
      Animated.parallel([
        Animated.timing(drag.x, {toValue: plan.toX, duration: plan.duration, easing: Easing.linear, useNativeDriver: true}),
        Animated.timing(drag.y, {toValue: plan.toY, duration: plan.duration, easing: plan.yEasing, useNativeDriver: true}),
        Animated.timing(angle, {toValue: plan.toAngle, duration: plan.duration, easing: Easing.linear, useNativeDriver: true}),
        ...(withGlow ? [Animated.timing(glow, {toValue: 1, duration: Math.min(220, plan.duration), useNativeDriver: true})] : []),
      ]).start(finish);
    },
    [reduced, fade, a.tokens.motion.fast, width, cardDiagonal, drag, angle, glow],
  );

  /** A button's throw: as if the card were flicked level from its top half; it lifts a touch, then gravity takes it. */
  const buttonThrow = (direction: 1 | -1): FlingStart => ({x: 0, y: 0, angle: 0, vx: direction * 1.8, vy: -0.15, pivot: 1});


  const accept = React.useCallback((start: FlingStart = buttonThrow(1)) => {
    if (isBusy) return;
    const text = fortunes[top]!;
    feel(haptics, 'success');
    AccessibilityInfo.announceForAccessibility(formatMessage(STRINGS.accepted, {text}));
    const finish = () => {
      setOrder(current => [...current.slice(1), current[0]!]);
      setAccepted(n => n + 1);
      setBusy(false);
    };
    setBusy(true);
    throwCard(1, start, finish, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBusy, top, haptics, throwCard]);

  const skip = React.useCallback((start: FlingStart = buttonThrow(-1)) => {
    if (isBusy) return;
    const next = fortunes[order[1] ?? top]!;
    AccessibilityInfo.announceForAccessibility(formatMessage(STRINGS.skipped, {text: next}));
    const finish = () => {
      setOrder(current => [...current.slice(1), current[0]!]);
      setBusy(false);
    };
    setBusy(true);
    throwCard(-1, start, finish, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBusy, order, top, throwCard]);

  const shuffle = () => {
    if (isBusy) return;
    const next = [...order];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(shuffleSeed.current() * (i + 1));
      [next[i], next[j]] = [next[j]!, next[i]!];
    }
    feel(haptics, 'tick');
    AccessibilityInfo.announceForAccessibility(formatMessage(STRINGS.shuffled, {text: fortunes[next[0]!]!}));
    if (reduced) {
      setOrder(next);
      return;
    }
    setBusy(true);
    riffle.setValue(0);
    Animated.timing(riffle, {toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true}).start(() => {
      riffle.setValue(0);
      setBusy(false);
    });
    setTimeout(() => setOrder(next), 350);
  };

  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isBusy,
        onMoveShouldSetPanResponder: (_e, g) => !isBusy && Math.abs(g.dx) > 6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: event => {
          held.current = {x: 0, y: 0, angle: 0, pivot: pivotSign(event.nativeEvent.pageY - boxTop.current, cardHeight)};
          tracker.reset();
          tracker.add(event.nativeEvent.pageX, event.nativeEvent.pageY, event.nativeEvent.timestamp);
        },
        onPanResponderMove: (event, g) => {
          tracker.add(event.nativeEvent.pageX, event.nativeEvent.pageY, event.nativeEvent.timestamp);
          const y = reduced ? 0 : g.dy * 0.6;
          const turn = reduced ? 0 : dragAngle(g.dx, width, held.current.pivot);
          held.current = {...held.current, x: g.dx, y, angle: turn};
          drag.setValue({x: g.dx, y});
          angle.setValue(turn);
        },
        onPanResponderRelease: (_e, g) => {
          const {x, y, angle: turn, pivot} = held.current;
          const tracked = tracker.velocity();
          const vx = Math.abs(tracked.vx) > Math.abs(g.vx) ? tracked.vx : g.vx;
          const vy = Math.abs(tracked.vy) > Math.abs(g.vy) ? tracked.vy : g.vy;
          const start: FlingStart = {x, y, angle: turn, vx, vy: reduced ? 0 : vy * 0.6, pivot};
          const outcome = releaseOutcome(g.dx, vx, width);
          if (outcome === 'accept') accept(start);
          else if (outcome === 'skip') skip(start);
          else {
            // Home, carrying the release velocity (Animated.spring takes it per second; PanResponder reports per ms).
            const springy = {stiffness: 220, damping: 17, mass: 1, useNativeDriver: true} as const;
            Animated.parallel([
              Animated.spring(drag, {...springy, toValue: {x: 0, y: 0}, velocity: {x: vx * 1000, y: start.vy * 1000}}),
              Animated.spring(angle, {...springy, toValue: 0, velocity: dragAngle(vx, width, pivot) * 1000}),
            ]).start();
            held.current = {...held.current, x: 0, y: 0, angle: 0};
          }
        },
        onPanResponderTerminate: () => {
          Animated.parallel([Animated.spring(drag, {toValue: {x: 0, y: 0}, useNativeDriver: true}), Animated.spring(angle, {toValue: 0, useNativeDriver: true})]).start();
          held.current = {...held.current, x: 0, y: 0, angle: 0};
        },
      }),
    [isBusy, drag, angle, reduced, width, cardHeight, accept, skip, tracker],
  );

  const colors = a.tokens.color as unknown as Record<string, string>;
  const fortuneText = textStyle(a, 'large');

  // Flat tilt only: rotateZ and a lift. rotateY/rotateX put part of the top card at negative depth, where the device
  // drew it behind the card below (cut along a slanted line); a 2D tilt can never intersect another card.
  const spin = angle.interpolate({inputRange: [-360, 360], outputRange: ['-360deg', '360deg']});
  const lift = reduced ? 1 : drag.x.interpolate({inputRange: [-width, -40, 0, 40, width], outputRange: [1.06, 1.04, 1, 1.04, 1.06], extrapolate: 'clamp'});

  const visible = order.slice(0, VISIBLE);
  return (
    <View style={styles.fill} testID="nonsense-deck">
      <Aurora intensity={0.35} />
      <View style={{paddingTop: safe.top + a.tokens.space.s3, paddingHorizontal: a.tokens.space.s4, gap: a.tokens.space.s1}}>
        <Heading level={1}>{STRINGS.deckTitle}</Heading>
        <Text type="supporting" color="secondary">
          {STRINGS.deckHint}
        </Text>
        <Text type="supporting" color="secondary">
          {accepted === 1 ? STRINGS.acceptedOne : formatMessage(STRINGS.acceptedCount, {count: accepted})}
        </Text>
      </View>
      <View style={[styles.fill, styles.center]}>
        <View ref={box} onLayout={measureBox} style={{width: cardWidth, height: cardHeight}}>
          {visible
            .map((fortune, depth) => ({fortune, depth}))
            .reverse()
            .map(({fortune, depth}) => {
              const isTop = depth === 0;
              const tone = colors[CARD_TONES[fortune % CARD_TONES.length]!] ?? a.tokens.color.accent;
              const restY = depth * a.tokens.space.s4;
              const restScale = 1 - depth * 0.05;
              // Cards under the top hold still (a native-driven Animated.subtract parallax made them vanish while the top
              // card was dragged); they fan out during a riffle.
              const riffleX = riffle.interpolate({inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, (depth % 2 ? 1 : -1) * 60, 0, (depth % 2 ? -1 : 1) * 40, 0]});
              const riffleTurn = riffle.interpolate({inputRange: [0, 0.5, 1], outputRange: ['0deg', `${(depth % 2 ? 1 : -1) * 12}deg`, '0deg']});
              const transform = [
                {translateX: isTop ? drag.x : 0},
                {translateY: isTop ? drag.y : restY},
                {scale: isTop ? lift : restScale},
                {rotateZ: isTop ? spin : `${(depth % 2 ? 1 : -1) * depth * 1.5}deg`},
                {translateX: riffleX},
                {rotateZ: riffleTurn},
              ];
              return (
                <Animated.View
                  key={fortune}
                  {...(isTop ? responder.panHandlers : null)}
                  accessible={isTop}
                  importantForAccessibility={isTop ? 'yes' : 'no-hide-descendants'}
                  accessibilityElementsHidden={!isTop}
                  accessibilityLabel={isTop ? formatMessage(STRINGS.cardLabel, {index: fortune + 1, count: fortunes.length, text: fortunes[fortune]!}) : undefined}
                  accessibilityHint={isTop ? STRINGS.cardHint : undefined}
                  accessibilityActions={isTop ? [{name: 'accept', label: STRINGS.accept}, {name: 'skip', label: STRINGS.skip}] : undefined}
                  onAccessibilityAction={isTop ? event => (event.nativeEvent.actionName === 'accept' ? accept() : skip()) : undefined}
                  testID={isTop ? 'nonsense-deck-top' : undefined}
                  style={[StyleSheet.absoluteFill, {zIndex: VISIBLE - depth, opacity: isTop ? fade : 1, transform}]}>
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      styles.face,
                      {
                        borderRadius: a.tokens.radius.page,
                        backgroundColor: a.tokens.color.backgroundInverted,
                        backgroundImage: `linear-gradient(145deg, ${withAlpha(tone, 1)} 0%, ${withAlpha(a.tokens.color.backgroundInverted, 1)} 100%)`,
                        padding: a.tokens.space.s6,
                        boxShadow: `0 12px 28px ${withAlpha(a.tokens.color.backgroundInverted, 0.35)}`,
                      },
                    ]}>
                    <RNText style={[textStyle(a, 'label'), {color: a.tokens.color.onDark, opacity: 0.8}]}>{formatMessage(STRINGS.cardNumber, {index: fortune + 1})}</RNText>
                    <View style={[styles.fill, styles.centerStart]}>
                      <RNText style={[fortuneText, {color: a.tokens.color.onDark, fontSize: (fortuneText.fontSize ?? 19) * 1.25, lineHeight: (fortuneText.lineHeight ?? (fortuneText.fontSize ?? 19) * 1.3) * 1.25}]}>{fortunes[fortune]}</RNText>
                    </View>
                    <RNText style={[textStyle(a, 'supporting'), {color: a.tokens.color.onDark, opacity: 0.7}]}>{STRINGS.appName}</RNText>
                  </View>
                  {isTop ? (
                    <Animated.View
                      pointerEvents="none"
                      style={[StyleSheet.absoluteFill, {borderRadius: a.tokens.radius.page, opacity: glow, boxShadow: `0 0 48px 12px ${withAlpha(a.tokens.color.iconYellow, 0.9)}`}]}
                    />
                  ) : null}
                </Animated.View>
              );
            })}
        </View>
      </View>
      <View style={{paddingHorizontal: a.tokens.space.s4, paddingBottom: tabClearance(chrome.bottom, safe.bottom) + a.tokens.space.s3}}>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: a.tokens.space.s2}}>
          <Button id="nonsense-deck-skip" label={STRINGS.skip} variant="secondary" icon="chevronLeft" onClick={() => skip()} isDisabled={isBusy} />
          <Button id="nonsense-deck-shuffle" label={STRINGS.shuffle} variant="secondary" icon="shuffle" onClick={shuffle} isDisabled={isBusy} />
          <Button id="nonsense-deck-accept" label={STRINGS.accept} variant="primary" icon="check" onClick={() => accept()} isDisabled={isBusy} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  center: {alignItems: 'center', justifyContent: 'center'},
  centerStart: {justifyContent: 'center'},
  face: {overflow: 'hidden'},
});
