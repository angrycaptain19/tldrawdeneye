/**
 * gameStore
 *
 * Shared reactive state bridging the game engine and the React / tldraw UI.
 * Uses a lightweight pub/sub pattern so any consumer (React component or
 * ShapeUtil) can subscribe to changes without coupling to the full game loop.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Shape of the store
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  player        – position (x, y in world grid units) and heading angle
 *  enemies       – sparse array of visible enemy positions + ids
 *  doorStates    – which doors are currently open (keyed by "x,y")
 *  tick          – monotonically-incrementing counter; bumped every update
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Usage
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ```ts
 * // Subscribe (returns unsubscribe fn)
 * const unsub = gameStore.subscribe(() => {
 *   console.log(gameStore.state.player);
 * });
 *
 * // Update from game loop
 * gameStore.update({ player: { x: 12, y: 12, angle: 0 } });
 *
 * // Cleanup
 * unsub();
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayerState {
  /** World-grid column (0 … WORLD_SIZE-1). Fractional positions are valid. */
  x: number;
  /** World-grid row (0 … WORLD_SIZE-1). Fractional positions are valid. */
  y: number;
  /** Heading in radians, measured clockwise from the positive-X axis. */
  angle: number;
}

export interface EnemyState {
  /** Unique identifier for this enemy agent. */
  id: string;
  /** World-grid column (fractional). */
  x: number;
  /** World-grid row (fractional). */
  y: number;
  /** Whether the enemy has been neutralised. */
  dead: boolean;
}

export interface GameState {
  /** Current player position and heading. */
  player: PlayerState;
  /** All known enemy positions (dead enemies are kept with dead=true). */
  enemies: EnemyState[];
  /** Open-door lookup: key is `"${col},${row}"`, value is true when open. */
  doorStates: Record<string, boolean>;
  /** Monotonically incrementing update counter (useful for change detection). */
  tick: number;
}

// ---------------------------------------------------------------------------
// Default / initial state
// ---------------------------------------------------------------------------

const DEFAULT_STATE: GameState = {
  player: {
    // Spawn the player roughly in the centre of the open atrium (row 12, col 12)
    x: 12,
    y: 12,
    angle: 0,
  },
  enemies: [
    // Pre-populate a few demo enemies so the minimap has something to show.
    // The real EnemySystem will overwrite these once the game loop is running.
    { id: 'enemy-nw', x: 4,  y: 5,  dead: false },
    { id: 'enemy-ne', x: 19, y: 5,  dead: false },
    { id: 'enemy-sw', x: 4,  y: 19, dead: false },
    { id: 'enemy-se', x: 19, y: 19, dead: false },
  ],
  doorStates: {},
  tick: 0,
};

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

type Listener = () => void;

function createGameStore() {
  // Deep-clone the default so mutations don't corrupt it.
  let _state: GameState = structuredClone(DEFAULT_STATE);
  const _listeners = new Set<Listener>();

  /** Read the current snapshot. Do NOT mutate the returned object. */
  function getState(): Readonly<GameState> {
    return _state;
  }

  /**
   * Merge a partial update into the store and notify all subscribers.
   *
   * Only the top-level keys you provide are replaced; everything else is
   * preserved.  The `tick` counter is always incremented automatically.
   */
  function update(partial: Partial<Omit<GameState, 'tick'>>): void {
    _state = {
      ..._state,
      ...partial,
      tick: _state.tick + 1,
    };
    for (const fn of _listeners) fn();
  }

  /**
   * Register a callback that fires whenever `update()` is called.
   *
   * @returns A zero-argument function that removes the subscription.
   */
  function subscribe(fn: Listener): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  }

  /** Reset the store back to its initial state (useful for tests / restarts). */
  function reset(): void {
    _state = structuredClone(DEFAULT_STATE);
    for (const fn of _listeners) fn();
  }

  return { getState, update, subscribe, reset } as const;
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/**
 * The global game-state store.
 *
 * All engine systems (game loop, DoorSystem, EnemySystem) call
 * `gameStore.update()` to push new data.  React components and ShapeUtils
 * (e.g. `MinimapShape`) call `gameStore.subscribe()` + `gameStore.getState()`
 * to react to those changes.
 */
export const gameStore = createGameStore();
