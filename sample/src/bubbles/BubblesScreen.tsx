/**
 * Liquid Glass Bubbles: glass bubbles with silly labels floating over a drifting aurora.
 *
 * - Glass: the library's MaterialSurface with `material` and `variant="glassClear"`: the platform package's native
 *   material view in the host (UIGlassEffect style .clear, interactive, on iOS 26+ — confirmed in the Preview host's
 *   view tree; a system blur below iOS 26), with nothing drawn over it but a faint highlight and the label; where the host has no material engine, or
 *   Reduce Transparency is on, the library's frosted translucent fill. A highlight and a rim make it read as a bubble.
 * - Behind them: the aurora tint and rows of big bold words scrolling in opposite directions (Marquee), the detailed,
 *   moving content glass needs to show its lensing; the labels carry a soft surface-coloured halo to stay readable.
 * - Each bubble bobs gently (native driver). Drag one: it follows the finger and squashes with the speed (wobble);
 *   on release it springs back to round and bumps any bubble it lands on out of the way.
 * - Tap one: it pops — a burst of particles and the `impact` haptic — and a new bubble with a new label floats up
 *   from the bottom. Screen readers: each bubble is a button ("Pet a cloud, bubble") whose activation pops it; pops
 *   are announced.
 * - Reduce Motion: no aurora drift, no bobbing, no particles; a pop fades and the new bubble appears in place.
 */
import React from 'react';
import {AccessibilityInfo, Animated, Easing, PanResponder, StyleSheet, Text as RNText, View} from 'react-native';
import type {LayoutChangeEvent} from 'react-native';
import {Heading, MaterialSurface, Text, textStyle, useAstryx, useHaptics} from '@astryx-exploration/react-native';
import {useAstryxInsets} from '@astryx-exploration/react-native-navigation';
import {formatMessage} from '@astryx-exploration/react-native/i18n';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Aurora, withAlpha} from '../Aurora';
import {Marquee} from '../Marquee';
import {feel, seeded, tabClearance} from '../feel';
import {STRINGS} from '../strings';
import {Particles} from './Particles';

interface BubbleModel {
  readonly id: number;
  readonly label: string;
  readonly size: number;
  readonly position: Animated.ValueXY;
  /** The resting top-left (kept in JS for the bump maths; the animated value is what draws). */
  at: {x: number; y: number};
  readonly isNew: boolean;
}

interface Burst {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

const START_COUNT = 6;
const TAP_SLOP = 8;

export function BubblesScreen(): React.JSX.Element {
  const a = useAstryx();
  const haptics = useHaptics();
  const safe = useSafeAreaInsets();
  const {chrome} = useAstryxInsets();
  const {color} = a.tokens;
  const [area, setArea] = React.useState({width: 0, height: 0});
  const [bubbles, setBubbles] = React.useState<BubbleModel[]>([]);
  const [bursts, setBursts] = React.useState<Burst[]>([]);
  const [popped, setPopped] = React.useState(0);
  const nextId = React.useRef(0);
  const labelCursor = React.useRef(0);
  const random = React.useRef(seeded(20261106));

  const nextLabel = () => {
    const labels = STRINGS.bubbleLabels;
    const label = labels[labelCursor.current % labels.length]!;
    labelCursor.current += 1;
    return label;
  };

  const sizeFor = React.useCallback((width: number) => Math.round(Math.min(150, Math.max(104, width * 0.3)) + random.current() * 18), []);

  /** A spot inside the area that overlaps the existing bubbles as little as a few tries can manage. */
  const freeSpot = React.useCallback(
    (size: number, others: readonly BubbleModel[], width: number, height: number) => {
      let best = {x: 0, y: 0};
      let bestScore = -Infinity;
      for (let attempt = 0; attempt < 24; attempt++) {
        const x = random.current() * Math.max(1, width - size);
        const y = random.current() * Math.max(1, height - size);
        const score = Math.min(...others.map(o => Math.hypot(o.at.x + o.size / 2 - (x + size / 2), o.at.y + o.size / 2 - (y + size / 2)) - (o.size + size) / 2), 9999);
        if (score > bestScore) {
          bestScore = score;
          best = {x, y};
        }
        if (score > 0) break;
      }
      return best;
    },
    [],
  );

  const makeBubble = React.useCallback(
    (others: readonly BubbleModel[], width: number, height: number, isNew: boolean): BubbleModel => {
      const size = sizeFor(width);
      const at = freeSpot(size, others, width, height);
      const start = isNew && !a.isReduceMotion ? {x: at.x, y: height + size} : at;
      return {id: nextId.current++, label: nextLabel(), size, position: new Animated.ValueXY(start), at, isNew};
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sizeFor, freeSpot, a.isReduceMotion],
  );

  // The first bubbles, once the area is known.
  React.useEffect(() => {
    if (area.width === 0 || bubbles.length > 0) return;
    const list: BubbleModel[] = [];
    for (let i = 0; i < START_COUNT; i++) list.push(makeBubble(list, area.width, area.height, false));
    setBubbles(list);
  }, [area, bubbles.length, makeBubble]);

  const clampAt = (b: BubbleModel, x: number, y: number) => ({x: Math.min(Math.max(0, x), area.width - b.size), y: Math.min(Math.max(0, y), area.height - b.size)});

  /** After a drag: the dropped bubble rests where it is; bubbles it overlaps are pushed out along the line between them. */
  const settle = (id: number, x: number, y: number) => {
    setBubbles(current => {
      const moved = current.find(b => b.id === id);
      if (!moved) return current;
      moved.at = clampAt(moved, x, y);
      Animated.spring(moved.position, {toValue: moved.at, useNativeDriver: true, friction: 6}).start();
      for (const other of current) {
        if (other.id === id) continue;
        const cx = moved.at.x + moved.size / 2;
        const cy = moved.at.y + moved.size / 2;
        const ox = other.at.x + other.size / 2;
        const oy = other.at.y + other.size / 2;
        const distance = Math.max(1, Math.hypot(ox - cx, oy - cy));
        const overlap = (moved.size + other.size) / 2 - distance;
        if (overlap <= 0) continue;
        const push = overlap + a.tokens.space.s2;
        other.at = clampAt(other, other.at.x + ((ox - cx) / distance) * push, other.at.y + ((oy - cy) / distance) * push);
        if (a.isReduceMotion) other.position.setValue(other.at);
        else Animated.spring(other.position, {toValue: other.at, useNativeDriver: true, friction: 5, tension: 60}).start();
      }
      return current;
    });
  };

  const pop = (id: number) => {
    const target = bubbles.find(b => b.id === id);
    if (!target) return;
    feel(haptics, 'pop');
    const others = bubbles.filter(b => b.id !== id);
    const fresh = makeBubble(others, area.width, area.height, true);
    if (!a.isReduceMotion) setBursts(list => [...list, {id: target.id, x: target.at.x + target.size / 2, y: target.at.y + target.size / 2}]);
    setBubbles([...others, fresh]);
    setPopped(n => n + 1);
    AccessibilityInfo.announceForAccessibility(formatMessage(STRINGS.popped, {label: target.label, next: fresh.label}));
    if (!a.isReduceMotion) Animated.spring(fresh.position, {toValue: fresh.at, useNativeDriver: true, friction: 7, tension: 30}).start();
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setArea(current => (current.width === width && current.height === height ? current : {width, height}));
  };

  return (
    <View style={styles.fill} testID="nonsense-bubbles">
      <Aurora />
      <Marquee />
      <MaterialSurface material="material" variant="glass" fill={color.backgroundSurface} style={{paddingTop: safe.top + a.tokens.space.s3, paddingBottom: a.tokens.space.s3, paddingHorizontal: a.tokens.space.s4, gap: a.tokens.space.s1}}>
        <Heading level={1}>{STRINGS.bubblesTitle}</Heading>
        <Text type="supporting" color="secondary">
          {STRINGS.bubblesHint}
        </Text>
        <Text type="supporting" color="secondary">
          {formatMessage(STRINGS.poppedCount, {count: popped})}
        </Text>
      </MaterialSurface>
      <View style={[styles.fill, {marginBottom: tabClearance(chrome.bottom, safe.bottom) + a.tokens.space.s2}]} onLayout={onLayout}>
        {bubbles.map(bubble => (
          <Bubble key={bubble.id} bubble={bubble} onSettle={settle} onPop={pop} />
        ))}
        {bursts.map(burst => (
          <Particles key={burst.id} x={burst.x} y={burst.y} seed={burst.id + 1} onDone={() => setBursts(list => list.filter(item => item.id !== burst.id))} />
        ))}
      </View>
    </View>
  );
}

function Bubble({bubble, onSettle, onPop}: {bubble: BubbleModel; onSettle: (id: number, x: number, y: number) => void; onPop: (id: number) => void}): React.JSX.Element {
  const a = useAstryx();
  const [bob] = React.useState(() => new Animated.Value(0));
  const [squashX] = React.useState(() => new Animated.Value(1));
  const [squashY] = React.useState(() => new Animated.Value(1));
  const [lift] = React.useState(() => new Animated.Value(1));

  // Bobbing: each bubble on its own rhythm.
  React.useEffect(() => {
    if (a.isReduceMotion) return;
    const ms = 2600 + (bubble.id % 5) * 420;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false}),
        Animated.timing(bob, {toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a.isReduceMotion, bob, bubble.id]);

  const responder = React.useMemo(() => {
    let start = {x: 0, y: 0};
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start = {...bubble.at};
        if (!a.isReduceMotion) Animated.spring(lift, {toValue: 1.08, useNativeDriver: true, friction: 5}).start();
      },
      onPanResponderMove: (_event, gesture) => {
        bubble.position.setValue({x: start.x + gesture.dx, y: start.y + gesture.dy});
        if (a.isReduceMotion) return;
        const speed = Math.min(2, Math.hypot(gesture.vx, gesture.vy));
        const horizontal = Math.abs(gesture.vx) >= Math.abs(gesture.vy);
        squashX.setValue(1 + (horizontal ? 0.12 : -0.08) * speed);
        squashY.setValue(1 + (horizontal ? -0.08 : 0.12) * speed);
      },
      onPanResponderRelease: (_event, gesture) => {
        if (Math.hypot(gesture.dx, gesture.dy) < TAP_SLOP) {
          onPop(bubble.id);
          return;
        }
        onSettle(bubble.id, start.x + gesture.dx, start.y + gesture.dy);
        if (!a.isReduceMotion) {
          Animated.parallel([
            Animated.spring(squashX, {toValue: 1, useNativeDriver: true, friction: 3, tension: 120}),
            Animated.spring(squashY, {toValue: 1, useNativeDriver: true, friction: 3, tension: 120}),
            Animated.spring(lift, {toValue: 1, useNativeDriver: true, friction: 4}),
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        onSettle(bubble.id, bubble.at.x, bubble.at.y);
        squashX.setValue(1);
        squashY.setValue(1);
        lift.setValue(1);
      },
    });
  }, [a.isReduceMotion, bubble, lift, onPop, onSettle, squashX, squashY]);

  const {color, space} = a.tokens;
  const translateBob = bob.interpolate({inputRange: [0, 1], outputRange: [0, -space.s2]});
  const label = textStyle(a, 'label');
  return (
    <Animated.View
      {...responder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={formatMessage(STRINGS.bubbleLabel, {label: bubble.label})}
      accessibilityHint={STRINGS.bubbleHint}
      accessibilityActions={[{name: 'activate'}]}
      onAccessibilityAction={() => onPop(bubble.id)}
      testID={`nonsense-bubble-${bubble.id}`}
      style={[styles.bubble, {width: bubble.size, height: bubble.size, transform: [...bubble.position.getTranslateTransform(), {translateY: translateBob}, {scale: lift}, {scaleX: squashX}, {scaleY: squashY}]}]}>
      <MaterialSurface
        material="material"
        variant="glassClear"
        interactive
        fill={color.backgroundSurface}
        cornerRadius={bubble.size / 2}
        style={[StyleSheet.absoluteFill, {borderRadius: bubble.size / 2, borderWidth: a.tokens.size.borderWidth, borderColor: withAlpha(color.onDark, 0.45), overflow: 'hidden'}]}>
        {/* The light on the glass: a soft highlight at the top-left (nothing else over the glass, so it stays clear). */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: bubble.size * 0.14,
            top: bubble.size * 0.1,
            width: bubble.size * 0.42,
            height: bubble.size * 0.26,
            borderRadius: bubble.size,
            backgroundImage: `radial-gradient(ellipse at center, ${withAlpha(color.onDark, 0.45)} 0%, ${withAlpha(color.onDark, 0)} 70%)`,
            transform: [{rotate: '-24deg'}],
          }}
        />
        <View style={styles.center} pointerEvents="none">
          <RNText style={[label, {color: color.textPrimary, textAlign: 'center', paddingHorizontal: space.s3, fontWeight: a.tokens.font.weight.bold, textShadowColor: withAlpha(color.backgroundSurface, 0.9), textShadowRadius: space.s1_5, textShadowOffset: {width: 0, height: 0}}]} numberOfLines={2} allowFontScaling={false}>
            {bubble.label}
          </RNText>
        </View>
      </MaterialSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  bubble: {position: 'absolute', left: 0, top: 0},
  center: {position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center'},
});
