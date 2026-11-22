// Every Shoresh Play mode by its id, for the router (#/play/<id>/<mode>).
import type { FunctionComponent } from 'preact';
import type { GameId } from '../lib/store.ts';
import { EchoGame } from './echo.tsx';
import { ForgeGame } from './forge.tsx';
import { GapGame } from './gap.tsx';
import { GenderGame } from './gender.tsx';
import type { GameProps } from './kit.ts';
import { MatchGame } from './match.tsx';
import { SixGame } from './six.tsx';
import { SmashGame } from './smash.tsx';
import { SnapGame } from './snap.tsx';
import { SortGame } from './sort.tsx';

export const GAME_COMPONENTS: Record<GameId, FunctionComponent<GameProps>> = {
  snap: SnapGame,
  sort: SortGame,
  forge: ForgeGame,
  smash: SmashGame,
  six: SixGame,
  echo: EchoGame,
  match: MatchGame,
  gender: GenderGame,
  gap: GapGame,
};
