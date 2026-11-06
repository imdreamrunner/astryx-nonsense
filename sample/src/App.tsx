/**
 * Astryx Instant Preview: three playful tabs built from the Astryx exploration library, made to run inside the
 * doc-site app through Astryx Preview with nothing the host does not already include (no new native modules).
 *
 * - Bubbles: glass bubbles (the platform package's native material — UIGlassEffect on iOS 26 — with a frosted
 *   fallback) over a drifting aurora; drag, bump, tap to pop.
 * - Deck: a 3D deck of absurd fortunes; swipe right to accept (flip, glow, fly off), left to send to the back; Shuffle.
 * - Disco: library components on a dance floor while the whole app steps through every Astryx theme.
 *
 * The theme lives in DiscoProvider above the AstryxProvider, so Theme Disco re-tints every tab. A brief wash in the new
 * theme's body colour cross-fades each change (the only motion left under Reduce Motion).
 */
import React from 'react';
import {Animated, StyleSheet, useColorScheme, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AstryxProvider, InsetsProvider, LayerProvider, useAstryx} from '@astryx-exploration/react-native';
import {astryxTabIcon, AstryxInsetsProvider, AstryxTabScreenLayout, useAstryxInsets, useAstryxNavigationOptions} from '@astryx-exploration/react-native-navigation';
import {AstryxNativeProvider} from '@astryx-exploration/react-native-platform';
import {BubblesScreen} from './bubbles/BubblesScreen';
import {DeckScreen} from './deck/DeckScreen';
import {DiscoProvider, useDisco} from './disco';
import {DiscoScreen} from './disco/DiscoScreen';
import {HOST_FONTS} from './feel';
import {STRINGS} from './strings';

export type AppTabs = {Bubbles: undefined; Deck: undefined; Disco: undefined};

const Tabs = createBottomTabNavigator<AppTabs>();

function Navigation(): React.JSX.Element {
  const a = useAstryx();
  const nav = useAstryxNavigationOptions();
  return (
    <NavigationContainer theme={nav.theme}>
      <Tabs.Navigator screenOptions={nav.tabs} screenLayout={AstryxTabScreenLayout}>
        <Tabs.Screen name="Bubbles" component={BubblesScreen} options={{title: STRINGS.tabBubbles, tabBarIcon: astryxTabIcon(a, 'heart')}} />
        <Tabs.Screen name="Deck" component={DeckScreen} options={{title: STRINGS.tabDeck, tabBarIcon: astryxTabIcon(a, 'layers')}} />
        <Tabs.Screen name="Disco" component={DiscoScreen} options={{title: STRINGS.tabDisco, tabBarIcon: astryxTabIcon(a, 'play')}} />
      </Tabs.Navigator>
    </NavigationContainer>
  );
}

/** The theme-change wash: the new body colour over everything, fading out. */
function ThemeWash(): React.JSX.Element {
  const a = useAstryx();
  const {changes} = useDisco();
  const [opacity] = React.useState(() => new Animated.Value(0));
  React.useEffect(() => {
    if (changes === 0) return;
    opacity.setValue(0.85);
    const fade = Animated.timing(opacity, {toValue: 0, duration: a.tokens.motion.slow * 2, useNativeDriver: true, isInteraction: false});
    fade.start();
    return () => fade.stop();
  }, [changes, opacity, a.tokens.motion.slow]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: a.tokens.color.backgroundBody, opacity}]} />;
}

function Root(): React.JSX.Element {
  const scheme = useColorScheme();
  const {insets, chrome} = useAstryxInsets();
  const {entry} = useDisco();
  return (
    <AstryxProvider theme={entry.theme} mode={scheme === 'dark' ? 'dark' : 'light'} fonts={HOST_FONTS}>
      <InsetsProvider insets={insets} chrome={chrome}>
        <LayerProvider>
          <View style={styles.fill}>
            <Navigation />
            <ThemeWash />
          </View>
        </LayerProvider>
      </InsetsProvider>
    </AstryxProvider>
  );
}

export function App(): React.JSX.Element {
  return (
    <AstryxNativeProvider surfaceMaterial="material">
      <SafeAreaProvider>
        <AstryxInsetsProvider>
          <DiscoProvider>
            <Root />
          </DiscoProvider>
        </AstryxInsetsProvider>
      </SafeAreaProvider>
    </AstryxNativeProvider>
  );
}

const styles = StyleSheet.create({fill: {flex: 1}});
