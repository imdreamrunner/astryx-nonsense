/**
 * The aurora behind the bubbles: a few large radial-gradient blobs (React Native 0.88's `backgroundImage`, colours
 * from the theme's categorical data tokens, its most saturated set) drifting slowly on the native driver, each on its own loop length so the pattern
 * never quite repeats. Decorative and touch-transparent. Under Reduce Motion the blobs stay still.
 */
import React from 'react';
import {Animated, Easing, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useAstryx} from '@astryx-exploration/react-native';

/** `#rrggbbaa` (the tokens' form) or `#rrggbb` with the alpha replaced, for a gradient stop. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.startsWith('#') ? color.slice(1) : '';
  if (hex.length !== 6 && hex.length !== 8) return color;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${hex.slice(0, 6)}${a}`;
}

const BLOBS = [
  {x: -0.2, y: -0.1, size: 1.1, dx: 0.18, dy: 0.12, ms: 9000, key: 'dataCategoricalPink'},
  {x: 0.45, y: 0.05, size: 1.0, dx: -0.16, dy: 0.18, ms: 11000, key: 'dataCategoricalBlue'},
  {x: -0.1, y: 0.45, size: 1.2, dx: 0.2, dy: -0.14, ms: 13000, key: 'dataCategoricalPurple'},
  {x: 0.4, y: 0.55, size: 0.9, dx: -0.12, dy: -0.2, ms: 10000, key: 'dataCategoricalTeal'},
  {x: 0.1, y: 0.2, size: 0.7, dx: 0.1, dy: 0.1, ms: 7000, key: 'dataCategoricalOrange'},
] as const;

export function Aurora({intensity = 0.55}: {intensity?: number}): React.JSX.Element {
  const a = useAstryx();
  const {width, height} = useWindowDimensions();
  const [drift] = React.useState(() => BLOBS.map(() => new Animated.Value(0)));
  React.useEffect(() => {
    if (a.isReduceMotion) {
      drift.forEach(value => value.setValue(0.5));
      return;
    }
    const loops = BLOBS.map((blob, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(drift[index]!, {toValue: 1, duration: blob.ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false}),
          Animated.timing(drift[index]!, {toValue: 0, duration: blob.ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false}),
        ]),
      ),
    );
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [a.isReduceMotion, drift]);

  const colors = a.tokens.color as unknown as Record<string, string>;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, {backgroundColor: a.tokens.color.backgroundBody}]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {BLOBS.map((blob, index) => {
        const size = Math.max(width, height) * blob.size;
        const color = colors[blob.key] ?? a.tokens.color.accent;
        const translateX = drift[index]!.interpolate({inputRange: [0, 1], outputRange: [0, blob.dx * width]});
        const translateY = drift[index]!.interpolate({inputRange: [0, 1], outputRange: [0, blob.dy * height]});
        const scale = drift[index]!.interpolate({inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1]});
        return (
          <Animated.View
            key={blob.key}
            style={{
              position: 'absolute',
              left: blob.x * width,
              top: blob.y * height,
              width: size,
              height: size,
              backgroundImage: `radial-gradient(circle at center, ${withAlpha(color, intensity)} 0%, ${withAlpha(color, intensity * 0.35)} 40%, ${withAlpha(color, 0)} 70%)`,
              transform: [{translateX}, {translateY}, {scale}],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({clip: {overflow: 'hidden'}});
