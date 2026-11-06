/**
 * A burst of shimmering particles where a bubble popped: small token-coloured dots flying out on the native driver,
 * shrinking and fading over about 0.7 s. Decorative; nothing under Reduce Motion (the caller does not render it).
 */
import React from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {useAstryx} from '@astryx-exploration/react-native';
import {seeded} from '../feel';

const COUNT = 18;
export const PARTICLES_MS = 700;

export function Particles({x, y, seed, onDone}: {x: number; y: number; seed: number; onDone: () => void}): React.JSX.Element {
  const a = useAstryx();
  const [progress] = React.useState(() => new Animated.Value(0));
  const {color, space, radius} = a.tokens;
  const palette = [color.iconPink, color.iconBlue, color.iconYellow, color.iconTeal, color.iconPurple, color.onDark];
  const pieces = React.useMemo(() => {
    const next = seeded(seed);
    return Array.from({length: COUNT}, (_, index) => {
      const angle = (index / COUNT) * Math.PI * 2 + next() * 0.4;
      const distance = space.s12 + next() * space.s12 * 1.5;
      return {dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, size: space.s1 + next() * space.s2, color: palette[index % palette.length]!};
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, a.tokens]);
  React.useEffect(() => {
    const run = Animated.timing(progress, {toValue: 1, duration: PARTICLES_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false});
    run.start(({finished}) => finished && onDone());
    return () => run.stop();
  }, [progress, onDone]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            left: x - piece.size / 2,
            top: y - piece.size / 2,
            width: piece.size,
            height: piece.size,
            borderRadius: radius.full,
            backgroundColor: piece.color,
            opacity: progress.interpolate({inputRange: [0, 0.6, 1], outputRange: [1, 0.9, 0]}),
            transform: [
              {translateX: progress.interpolate({inputRange: [0, 1], outputRange: [0, piece.dx]})},
              {translateY: progress.interpolate({inputRange: [0, 1], outputRange: [0, piece.dy]})},
              {scale: progress.interpolate({inputRange: [0, 0.2, 1], outputRange: [0.4, 1.4, 0.2]})},
            ],
          }}
        />
      ))}
    </View>
  );
}
