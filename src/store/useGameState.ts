/**
 * useGameState.ts
 *
 * React hooks that subscribe to the shared gameStore via
 * useSyncExternalStore (React 18+).  Returns the current GameState
 * snapshot; the component re-renders whenever the game loop writes a new
 * state, keeping React strictly in sync without any extra boilerplate.
 *
 * This file is intentionally separate from gameStore.ts so that the
 * store itself has NO React dependency -- the game engine can import it
 * safely in a non-React context.
 *
 * Usage
 * -----
 * @example
 * import { useGameState } from '../store/useGameState'
 *
 * function HudOverlay() {
 *   const { player, phase } = useGameState()
 *   return (
 *     <div>
 *       {phase === 'playing' && <span>HP: {player.health}</span>}
 *     </div>
 *   )
 * }
 */

import { useSyncExternalStore } from 'react'
import { gameStore, getStoreApi, type GameState } from './gameStore'

const api = getStoreApi()

/**
 * Subscribe to the full game state.
 * Re-renders on every game-loop tick.
 */
export function useGameState(): Readonly<GameState> {
  return useSyncExternalStore(
    api.subscribe,
    api.getSnapshot,
    api.getServerSnapshot,
  )
}

/**
 * Subscribe to a derived/selected slice of the game state.
 * The component only re-renders when the selected value changes
 * (by reference equality).
 *
 * @example
 *   const health = useGameSelector(s => s.player.health)
 */
export function useGameSelector<T>(selector: (state: GameState) => T): T {
  return useSyncExternalStore(
    (onStoreChange) => gameStore.subscribe(() => onStoreChange()),
    () => selector(gameStore.getState()),
    () => selector(gameStore.getState()),
  )
}
