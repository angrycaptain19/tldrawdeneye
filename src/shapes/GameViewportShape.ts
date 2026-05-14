/**
 * GameViewportShape
 *
 * Custom tldraw ShapeUtil that embeds the raycaster canvas inside a tldraw
 * shape, allowing the game viewport to be positioned, scaled, and layered
 * alongside other tldraw content (minimap, HUD panels, etc.).
 *
 * This stub wires the shape to the shared gameStore so that once a real
 * ShapeUtil subclass is added it can call gameStore.subscribe() in its
 * component lifecycle to react to game-state changes without touching the
 * tldraw store.
 *
 * TODO: implement full ShapeUtil subclass with component() and indicator().
 */

import { gameStore, type GameState } from '../store/gameStore'

// ---------------------------------------------------------------------------
// Shape props type (used when the full ShapeUtil is implemented)
// ---------------------------------------------------------------------------

export interface GameViewportShapeProps {
  /** Width of the viewport in tldraw canvas units */
  w: number
  /** Height of the viewport in tldraw canvas units */
  h: number
}

// ---------------------------------------------------------------------------
// Subscription helper
// ---------------------------------------------------------------------------

/**
 * Subscribe the viewport to the game store.
 * Returns an unsubscribe function.
 *
 * Call this in the ShapeUtil component() lifecycle (e.g. a useEffect):
 *
 * @example
 * useEffect(() => {
 *   return subscribeGameViewport((state) => {
 *     // re-draw the raycaster canvas with the new game state
 *   })
 * }, [])
 */
export function subscribeGameViewport(
  onUpdate: (state: GameState) => void,
): () => void {
  return gameStore.subscribeWithInitial(onUpdate)
}

// ---------------------------------------------------------------------------
// Placeholder class (will become a tldraw ShapeUtil subclass)
// ---------------------------------------------------------------------------

/**
 * Lightweight placeholder so the module is importable and the subscription
 * contract is exercised even before the full ShapeUtil is built.
 */
export class GameViewportShape {
  private _unsub: (() => void) | null = null

  /**
   * Attach the shape to the game store.  Call once when the shape mounts.
   * @param onStateChange  Callback invoked on every game-loop tick.
   */
  mount(onStateChange: (state: GameState) => void): void {
    this._unsub = gameStore.subscribeWithInitial(onStateChange)
  }

  /**
   * Detach from the game store.  Call once when the shape unmounts.
   */
  unmount(): void {
    this._unsub?.()
    this._unsub = null
  }
}
