/**
 * A busy, slowly moving layer for glass to bend: rows of big bold words ("NONSENSE", "BUBBLES", …) in the theme's
 * categorical colours, scrolling in alternating directions on the native driver. Liquid Glass only reads when there
 * is detailed, high-contrast content behind it; this is that content. Decorative and touch-transparent; still under
 * Reduce Motion.
 */
import React from 'react';
import {Animated, Easing, StyleSheet, Text as RNText, useWindowDimensions, View} from 'react-native';
import {textStyle, useAstryx} from '@astryx-exploration/react-native';
import {withAlpha} from './Aurora';

const WORDS = ['NONSENSE', 'BUBBLES', 'GLASS', 'WOBBLE', 'POP', 'ASTRYX', 'FIZZ', 'BOING'];
const TONES = ['dataCategoricalPink', 'dataCategoricalBlue', 'dataCategoricalOrange', 'dataCategoricalPurple', 'dataCategoricalTeal', 'dataCategoricalGreen'] as const;
const ROWS = 9;

export function Marquee({opacity = 0.9}: {opacity?: number}): React.JSX.Element {
  const a = useAstryx();
  const {width} = useWindowDimensions();
  const [shift] = React.useState(() => new Animated.Value(0));
  const [rowWidth, setRowWidth] = React.useState(0);

  React.useEffect(() => {
    if (a.isReduceMotion || rowWidth === 0) return;
    shift.setValue(0);
    const loop = Animated.loop(Animated.timing(shift, {toValue: 1, duration: 26000, easing: Easing.linear, useNativeDriver: true, isInteraction: false}));
    loop.start();
    return () => loop.stop();
  }, [a.isReduceMotion, rowWidth, shift]);

  const colors = a.tokens.color as unknown as Record<string, string>;
  const base = textStyle(a, 'display-1');
  const size = Math.round(Math.max(56, width / 6));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="nonsense-marquee">
      {Array.from({length: ROWS}, (_, row) => {
        const words = Array.from({length: 6}, (_, i) => WORDS[(row * 3 + i) % WORDS.length]!);
        const direction = row % 2 === 0 ? -1 : 1;
        // One copy of the row's words slides by its own width, so the doubled row loops without a seam.
        const translateX = shift.interpolate({inputRange: [0, 1], outputRange: direction < 0 ? [0, -rowWidth] : [-rowWidth, 0]});
        return (
          <Animated.View key={row} style={[styles.row, {transform: [{translateX}, {rotate: '-12deg'}]}]}>
            {[0, 1].map(copy => (
              <View key={copy} style={styles.copy} onLayout={copy === 0 && row === 0 ? event => setRowWidth(event.nativeEvent.layout.width) : undefined}>
                {words.map((word, i) => (
                  <RNText
                    key={i}
                    allowFontScaling={false}
                    style={[base, {fontSize: size, lineHeight: size * 1.05, fontWeight: a.tokens.font.weight.bold, color: withAlpha(colors[TONES[(row + i) % TONES.length]!] ?? a.tokens.color.accent, opacity), marginRight: size * 0.4}]}>
                    {word}
                  </RNText>
                ))}
              </View>
            ))}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {overflow: 'hidden', justifyContent: 'center'},
  row: {flexDirection: 'row', marginLeft: -80},
  copy: {flexDirection: 'row'},
});
