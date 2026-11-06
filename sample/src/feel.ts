/**
 * Haptics for the demo: the library's haptics (the host's native engine through the platform package) when it is
 * on; else, on Android only, a 12 ms Vibration from React Native core (iOS's Vibration ignores the length and buzzes
 * for 0.4 s); else nothing. Moments only: a pop, a card accepted, a theme change.
 */
import {Platform, Vibration} from 'react-native';
import type {Haptics} from '@astryx-exploration/react-native';

export type Feel = 'pop' | 'success' | 'tick';

export function feel(haptics: Haptics, kind: Feel): void {
  if (haptics.enabled) {
    if (kind === 'pop') haptics.impact('rigid');
    else if (kind === 'success') haptics.outcome('success');
    else haptics.select();
    return;
  }
  if (Platform.OS === 'android' && kind !== 'tick') Vibration.vibrate(12);
}

/** A small seeded generator (deterministic shapes for particles and confetti). */
export function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * The fonts the doc-site binary bundles (Neutral's Figtree and every theme's families), so Theme Disco's themes draw
 * their own type. The project registers no fonts natively; these resolve because the host has them.
 */
export const HOST_FONTS = {
  Figtree: {400: 'Figtree-Regular', 500: 'Figtree-Medium', 600: 'Figtree-SemiBold', 700: 'Figtree-Bold'},
  'Albert Sans': {400: 'AlbertSans-Regular', 500: 'AlbertSans-Medium', 600: 'AlbertSans-SemiBold', 700: 'AlbertSans-Bold'},
  'Crimson Text': {400: 'CrimsonText-Regular', 600: 'CrimsonText-SemiBold', 700: 'CrimsonText-Bold'},
  'DM Sans': {400: 'DMSans-Regular', 500: 'DMSans-Medium', 600: 'DMSans-SemiBold', 700: 'DMSans-Bold'},
  Fraunces: {400: 'Fraunces-Regular', 500: 'Fraunces-Medium', 600: 'Fraunces-SemiBold', 700: 'Fraunces-Bold'},
  Fustat: {400: 'Fustat-Regular', 500: 'Fustat-Medium', 600: 'Fustat-SemiBold', 700: 'Fustat-Bold'},
  'JetBrains Mono': {400: 'JetBrainsMono-Regular', 500: 'JetBrainsMono-Medium', 600: 'JetBrainsMono-SemiBold', 700: 'JetBrainsMono-Bold'},
  'Manufacturing Consent': {400: 'ManufacturingConsent-Regular'},
  Montserrat: {400: 'Montserrat-Regular', 500: 'Montserrat-Medium', 600: 'Montserrat-SemiBold', 700: 'Montserrat-Bold'},
  Outfit: {400: 'Outfit-Regular', 500: 'Outfit-Medium', 600: 'Outfit-SemiBold', 700: 'Outfit-Bold'},
  'Playwrite US Trad': {400: 'PlaywriteUSTrad-Regular'},
  Poppins: {400: 'Poppins-Regular', 500: 'Poppins-Medium', 600: 'Poppins-SemiBold', 700: 'Poppins-Bold'},
  Sarina: {400: 'Sarina-Regular'},
} as const;

/**
 * Room to leave above the native tab bar. The navigation tier measures the bar (`chrome.bottom`); where that report
 * has not arrived (it reads 0 in the Preview host's first frames), the safe area plus UIKit's 49 pt bar is the floor.
 */
export const TAB_BAR_FLOOR = 50;
export function tabClearance(chromeBottom: number | undefined, safeBottom: number): number {
  return Math.max(chromeBottom ?? 0, safeBottom + TAB_BAR_FLOOR);
}
