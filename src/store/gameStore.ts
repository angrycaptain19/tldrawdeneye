/**
 * gameStore.ts
 *
 * Lightweight reactive store that holds all live game state.
 * Implements a minimal pub/sub ("atom") pattern so any subscriber
 * (React components, tldraw shape utils, etc.) can react to updates
 * without coupling to tldraw's internal store.
 *
 * Design rules
 * ------------
 * - The game loop is the ONLY writer (via `gameStore.setState`).
 * - Shapes / UI are read-only consumers (via `getState` + `subscribe`).
 * - No tldraw store mutations happen here; this store is fully independent.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Vec2 = { x: number; y: number }

export type GamePhase =
  | 'menu'
  | 'playing'
  | 'paused'
  | 'mission_complete'
  | 'game_over'

export interface PlayerState {
  /** World-space position */
  position: Vec2
  /** Direction the player faces (radians, 0 = +X axis) */
  angle: number
  health: number
  /** 0-100 */
  armor: number
  /** Bullets in current magazine */
  ammo: number
  /** Total reserve ammo */
  ammoReserve: number
  /** e.g. "PP7", "KF7 Soviet", "Golden Gun" */
  currentWeapon: string
}

export type EnemyStatus = 'patrol' | 'alert' | 'attack' | 'dead'

export interface EnemyState {
  id: string
  position: Vec2
  angle: number
  health: number
  status: EnemyStatus
}

export type ObjectiveStatus = 'pending' | 'complete' | 'failed'

export interface ObjectiveState {
  id: string
  label: string
  status: ObjectiveStatus
}

export type DoorState = 'closed' | 'opening' | 'open' | 'closing'

export interface DoorEntry {
  id: string
  position: Vec2
  state: DoorState
  /** 0-1, 0 = fully closed, 1 = fully open */
  openFraction: number
}

export interface GameState {
  phase: GamePhase
  /** Elapsed time since mission start (seconds) */
  elapsedTime: number
  player: PlayerState
  enemies: EnemyState[]
  objectives: ObjectiveState[]
  doors: DoorEntry[]
  /** Arbitrary key/value bag for HUD flags, cheats, etc. */
  flags: Record<string, boolean | number | string>
}

// ---------------------------------------------------------------------------
// Default / initial state
// ---------------------------------------------------------------------------

export function createInitialGameState(): GameState {
  return {
    phase: 'menu',
    elapsedTime: 0,
    player: {
      position: { x: 1.5, y: 1.5 },
      angle: 0,
      health: 100,
      armor: 0,
      ammo: 7,
      ammoReserve: 21,
      currentWeapon: 'PP7',
    },
    enemies: [],
    objectives: [],
    doors: [],
    flags: {},
  }
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

type Subscriber = (state: GameState) => void

/**
 * A minimal reactive atom.  All methods are synchronous and allocation-light
 * so they are safe to call inside a 60 Hz game loop.
 */
class GameStore {
  private _state: GameState = createInitialGameState()
  private _subscribers = new Set<Subscriber>()

  // -- Read ------------------------------------------------------------------

  /**
   * Returns the current state snapshot.
   * Callers that need reactive updates should use `subscribe` instead.
   */
  getState(): Readonly<GameState> {
    return this._state
  }

  // -- Write -----------------------------------------------------------------

  /**
   * Merge a partial update into the current state and notify all subscribers.
   *
   * Only the game loop should call this.  Pass a shallow-merge object or a
   * function that receives the previous state and returns a new one.
   *
   * @example
   *   gameStore.setState({ phase: 'playing' })
   *   gameStore.setState(prev => ({
   *     ...prev,
   *     player: { ...prev.player, health: prev.player.health - 10 },
   *   }))
   */
  setState(
    update: Partial<GameState> | ((prev: GameState) => GameState),
  ): void {
    if (typeof update === 'function') {
      this._state = update(this._state)
    } else {
      this._state = { ...this._state, ...update }
    }
    this._notify()
  }

  /**
   * Convenience writer for nested player fields.
   */
  setPlayer(update: Partial<PlayerState>): void {
    this._state = {
      ...this._state,
      player: { ...this._state.player, ...update },
    }
    this._notify()
  }

  /**
   * Replace the full enemies array (preferred to mutate-in-place).
   */
  setEnemies(enemies: EnemyState[]): void {
    this._state = { ...this._state, enemies }
    this._notify()
  }

  /**
   * Update a single enemy by id (no-op if not found).
   */
  updateEnemy(id: string, update: Partial<EnemyState>): void {
    const idx = this._state.enemies.findIndex(e => e.id === id)
    if (idx === -1) return
    const enemies = [...this._state.enemies]
    enemies[idx] = { ...enemies[idx], ...update }
    this._state = { ...this._state, enemies }
    this._notify()
  }

  /**
   * Update a single door by id (no-op if not found).
   */
  updateDoor(id: string, update: Partial<DoorEntry>): void {
    const idx = this._state.doors.findIndex(d => d.id === id)
    if (idx === -1) return
    const doors = [...this._state.doors]
    doors[idx] = { ...doors[idx], ...update }
    this._state = { ...this._state, doors }
    this._notify()
  }

  /**
   * Update a single objective by id (no-op if not found).
   */
  updateObjective(id: string, update: Partial<ObjectiveState>): void {
    const idx = this._state.objectives.findIndex(o => o.id === id)
    if (idx === -1) return
    const objectives = [...this._state.objectives]
    objectives[idx] = { ...objectives[idx], ...update }
    this._state = { ...this._state, objectives }
    this._notify()
  }

  /**
   * Reset the store to a fresh initial state (e.g. on new mission start).
   */
  reset(): void {
    this._state = createInitialGameState()
    this._notify()
  }

  // -- Subscribe -------------------------------------------------------------

  /**
   * Register a subscriber callback.
   * Returns an unsubscribe function -- call it to stop receiving updates.
   *
   * @example
   *   const unsub = gameStore.subscribe(state => console.log(state.phase))
   *   // later:
   *   unsub()
   */
  subscribe(fn: Subscriber): () => void {
    this._subscribers.add(fn)
    return () => {
      this._subscribers.delete(fn)
    }
  }

  /**
   * Get the current state and subscribe to future changes in one call.
   * Useful when you want to initialise local state immediately.
   *
   * @example
   *   const unsub = gameStore.subscribeWithInitial(state => render(state))
   */
  subscribeWithInitial(fn: Subscriber): () => void {
    fn(this._state)
    return this.subscribe(fn)
  }

  // -- Internal --------------------------------------------------------------

  private _notify(): void {
    for (const fn of this._subscribers) {
      fn(this._state)
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/**
 * The one shared instance used by the game loop and all UI consumers.
 */
export const gameStore = new GameStore()

// ---------------------------------------------------------------------------
// React hook helper (no React import needed in this file)
// ---------------------------------------------------------------------------

/**
 * Returns an object compatible with React's useSyncExternalStore.
 * Import getStoreApi in a React file; use useGameState from useGameState.ts.
 */
export function getStoreApi() {
  return {
    subscribe: (fn: () => void) => {
      return gameStore.subscribe(() => fn())
    },
    getSnapshot: () => gameStore.getState(),
    getServerSnapshot: () => gameStore.getState(),
  } as const
}
