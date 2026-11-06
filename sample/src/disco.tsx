/**
 * Theme Disco's state, shared by the whole app: which Astryx theme is on (the App's AstryxProvider reads it, so every
 * tab re-tints) and whether party mode is cycling them. `next()` moves one theme along the library's own list
 * (ASTRYX_THEMES: Neutral, Stone, Matcha, Gothic, Chocolate, Butter, Y2K, Default).
 */
import React from 'react';
import {ASTRYX_THEMES} from '@astryx-exploration/react-native';
import type {AstryxThemeEntry} from '@astryx-exploration/react-native';

export interface Disco {
  readonly entry: AstryxThemeEntry;
  readonly index: number;
  /** Bumps on every theme change (the flash overlay keys off it). */
  readonly changes: number;
  next(): void;
  readonly isParty: boolean;
  setParty(isParty: boolean): void;
}

const DiscoContext = React.createContext<Disco | null>(null);

export function DiscoProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const [index, setIndex] = React.useState(0);
  const [changes, setChanges] = React.useState(0);
  const [isParty, setParty] = React.useState(false);
  const next = React.useCallback(() => {
    setIndex(current => (current + 1) % ASTRYX_THEMES.length);
    setChanges(current => current + 1);
  }, []);
  const value = React.useMemo<Disco>(() => ({entry: ASTRYX_THEMES[index]!, index, changes, next, isParty, setParty}), [index, changes, next, isParty]);
  return <DiscoContext.Provider value={value}>{children}</DiscoContext.Provider>;
}

export function useDisco(): Disco {
  const disco = React.useContext(DiscoContext);
  if (!disco) throw new Error('useDisco outside DiscoProvider');
  return disco;
}
