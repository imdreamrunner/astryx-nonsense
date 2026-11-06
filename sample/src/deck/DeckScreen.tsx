/**
 * 3D Card Deck: a stack of tilted cards with absurd fortunes.
 *
 * - The top card follows the finger, tilting (`rotateZ`) and lifting (scale) with the drag — a flat tilt, so it can
 *   never cut into the cards under it — over a fanned, stepped stack.
 * - Swipe right past a third of the width (or fling): the card glows and flies off tilted, with the `success`
 *   haptic; the fortune counts as accepted and goes to the bottom of the deck (the deck never runs out).
 * - Swipe left: the card slides away and tucks in at the back. A short drag springs back.
 * - Shuffle riffles the visible cards and deals a new order. Accept / Skip / Shuffle are buttons too (gestures are
 *   shortcuts), and the top card's accessibility actions are Accept and Skip; results are announced.
 * - Reduce Motion: no tilt or fly-off; the next card simply appears.
 * - Native driver: every card has the same transform keys in the same order, and the top card's
 *   drag values are new for each top card, so nothing is reset under a card that is still drawn.
 */
import React from 'react';
import {AccessibilityInfo, Animated, Easing, PanResponder, StyleSheet, Text as RNText, useWindowDimensions, View} from 'react-native';
import {Button, Heading, Text, textStyle, useAstryx, useHaptics} from '@astryx-exploration/react-native';
import {useAstryxInsets} from '@astryx-exploration/react-native-navigation';
import {formatMessage} from '@astryx-exploration/react-native/i18n';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Aurora, withAlpha} from '../Aurora';
import {feel, seeded, tabClearance} from '../feel';
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
  const {drag, glow} = React.useMemo(() => ({drag: new Animated.ValueXY({x: 0, y: 0}), glow: new Animated.Value(0)}), [top]);
  const [riffle] = React.useState(() => new Animated.Value(0));
  const shuffleSeed = React.useRef(seeded(42));
  const reduced = a.isReduceMotion;


  const accept = React.useCallback(() => {
    if (isBusy) return;
    const text = fortunes[top]!;
    feel(haptics, 'success');
    AccessibilityInfo.announceForAccessibility(formatMessage(STRINGS.accepted, {text}));
    const finish = () => {
      setOrder(current => [...current.slice(1), current[0]!]);
      setAccepted(n => n + 1);
      setBusy(false);
    };
    if (reduced) {
      finish();
      return;
    }
    setBusy(true);
    Animated.sequence([
      Animated.timing(glow, {toValue: 1, duration: 220, useNativeDriver: true}),
      Animated.timing(drag, {toValue: {x: width * 1.5, y: -140}, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true}),
    ]).start(finish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBusy, top, haptics, reduced, width, drag, glow]);

  const skip = React.useCallback(() => {
    if (isBusy) return;
    const next = fortunes[order[1] ?? top]!;
    AccessibilityInfo.announceForAccessibility(formatMessage(STRINGS.skipped, {text: next}));
    const finish = () => {
      setOrder(current => [...current.slice(1), current[0]!]);
      setBusy(false);
    };
    if (reduced) {
      finish();
      return;
    }
    setBusy(true);
    Animated.timing(drag, {toValue: {x: -width * 1.3, y: 40}, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true}).start(finish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBusy, order, top, reduced, width, drag]);

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
        onPanResponderMove: (_e, g) => {
          drag.setValue({x: g.dx, y: reduced ? 0 : g.dy * 0.4});
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dx > width / 3 || g.vx > 0.8) accept();
          else if (g.dx < -width / 3 || g.vx < -0.8) skip();
          else Animated.spring(drag, {toValue: {x: 0, y: 0}, useNativeDriver: true, friction: 6}).start();
        },
        onPanResponderTerminate: () => Animated.spring(drag, {toValue: {x: 0, y: 0}, useNativeDriver: true}).start(),
      }),
    [isBusy, drag, reduced, width, accept, skip],
  );

  const cardWidth = Math.min(width - a.tokens.space.s12 * 2, 320);
  const cardHeight = cardWidth * 1.3;
  const colors = a.tokens.color as unknown as Record<string, string>;
  const fortuneText = textStyle(a, 'large');

  // Flat tilt only: rotateZ and a lift. rotateY/rotateX put part of the top card at negative depth, where the device
  // drew it behind the card below (cut along a slanted line); a 2D tilt can never intersect another card.
  const spin = reduced ? '0deg' : drag.x.interpolate({inputRange: [-width, 0, width], outputRange: ['-16deg', '0deg', '16deg']});
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
          {formatMessage(STRINGS.acceptedCount, {count: accepted})}
        </Text>
      </View>
      <View style={[styles.fill, styles.center]}>
        <View style={{width: cardWidth, height: cardHeight}}>
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
                  style={[StyleSheet.absoluteFill, {zIndex: VISIBLE - depth, transform}]}>
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
          <Button id="nonsense-deck-skip" label={STRINGS.skip} variant="secondary" icon="chevronLeft" onClick={skip} isDisabled={isBusy} />
          <Button id="nonsense-deck-shuffle" label={STRINGS.shuffle} variant="secondary" icon="shuffle" onClick={shuffle} isDisabled={isBusy} />
          <Button id="nonsense-deck-accept" label={STRINGS.accept} variant="primary" icon="check" onClick={accept} isDisabled={isBusy} />
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
