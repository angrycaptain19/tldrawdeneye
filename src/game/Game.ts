/**
 * Game
 *
 * Top-level game loop coordinator.  Owns the requestAnimationFrame loop,
 * orchestrates Input => Player => EnemySystem => DoorSystem => Raycaster =>
 * SpriteRenderer each frame, and pushes updates to the shared gameStore
 * each tick.
 *
 * Design contract
 * ---------------
 * - gameStore is the ONLY place game state is written.
 * - The tldraw store is NEVER mutated from inside this class.
 * - Shape utils (GameViewportShape, MinimapShape) subscribe to gameStore
 *   independently and re-render themselves when notified.
 */

import {
  gameStore,
  createInitialGameState,
  type EnemyState,
  type DoorEntry,
  type ObjectiveState,
} from '../store/gameStore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TARGET_FPS = 60
const TARGET_FRAME_MS = 1000 / TARGET_FPS

// ---------------------------------------------------------------------------
// Game class
// ---------------------------------------------------------------------------

export class Game {
  private _rafId: number | null = null
  private _lastTimestamp: number | null = null
  private _running = false

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  /**
   * Initialise the game world.
   * Call once before start() to seed the store with mission data.
   *
   * @param enemies      Initial set of enemy agents for this level.
   * @param doors        Initial door entries for this level.
   * @param objectives   Mission objectives (id + label).
   */
  init(
    enemies: EnemyState[] = [],
    doors: DoorEntry[] = [],
    objectives: Array<{ id: string; label: string }> = [],
  ): void {
    const fresh = createInitialGameState()
    gameStore.setState({
      ...fresh,
      phase: 'playing',
      enemies,
      doors,
      objectives: objectives.map(
        (o): ObjectiveState => ({ ...o, status: 'pending' }),
      ),
    })
  }

  /**
   * Start the game loop.  Safe to call multiple times -- subsequent calls
   * are no-ops while the loop is already running.
   */
  start(): void {
    if (this._running) return
    this._running = true
    gameStore.setState({ phase: 'playing' })
    this._lastTimestamp = null
    this._rafId = requestAnimationFrame(this._loop)
  }

  /**
   * Pause the game loop without discarding state.
   */
  pause(): void {
    if (!this._running) return
    this._running = false
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    gameStore.setState({ phase: 'paused' })
  }

  /**
   * Resume a paused game.
   */
  resume(): void {
    if (this._running) return
    this._running = true
    gameStore.setState({ phase: 'playing' })
    this._lastTimestamp = null
    this._rafId = requestAnimationFrame(this._loop)
  }

  /**
   * Completely stop and reset to the main-menu state.
   */
  stop(): void {
    this.pause()
    gameStore.reset()
  }

  // ------------------------------------------------------------------
  // Core RAF loop
  // ------------------------------------------------------------------

  /**
   * Arrow function so `this` is always bound, even when passed to rAF.
   */
  private _loop = (timestamp: number): void => {
    if (!this._running) return

    if (this._lastTimestamp === null) {
      this._lastTimestamp = timestamp
    }

    const rawDelta = timestamp - this._lastTimestamp
    // Cap delta to avoid spiral-of-death after tab wake-up
    const delta = Math.min(rawDelta, TARGET_FRAME_MS * 4) / 1000 // seconds
    this._lastTimestamp = timestamp

    this._tick(delta)

    this._rafId = requestAnimationFrame(this._loop)
  }

  /**
   * Single frame update.  Reads current state, runs sub-system updates,
   * and writes the new state back to gameStore in one batch.
   *
   * Sub-system implementations (Input, Player, EnemySystem, etc.) will be
   * wired in here as they are built out.  For now each section is a
   * clearly-labelled stub that shows the intended data flow.
   */
  private _tick(delta: number): void {
    const prev = gameStore.getState()

    // Guard: only tick when playing
    if (prev.phase !== 'playing') return

    // ----------------------------------------------------------------
    // 1. Input sampling  (TODO: delegate to Input class)
    // ----------------------------------------------------------------
    // const inputSnapshot = Input.sample()

    // ----------------------------------------------------------------
    // 2. Player update  (TODO: delegate to Player class)
    // ----------------------------------------------------------------
    // const nextPlayer = Player.update(prev.player, inputSnapshot, delta, world)
    const nextPlayer = prev.player

    // ----------------------------------------------------------------
    // 3. Enemy update  (TODO: delegate to EnemySystem class)
    // ----------------------------------------------------------------
    // const nextEnemies = EnemySystem.update(prev.enemies, nextPlayer, delta, world)
    const nextEnemies = prev.enemies

    // ----------------------------------------------------------------
    // 4. Door update  (TODO: delegate to DoorSystem class)
    // ----------------------------------------------------------------
    // const nextDoors = DoorSystem.update(prev.doors, nextPlayer, delta)
    const nextDoors = prev.doors

    // ----------------------------------------------------------------
    // 5. Objective check  (TODO: implement win/fail conditions)
    // ----------------------------------------------------------------
    const nextObjectives = prev.objectives

    // ----------------------------------------------------------------
    // 6. Commit new state to the store -- one write per tick
    // ----------------------------------------------------------------
    gameStore.setState({
      elapsedTime: prev.elapsedTime + delta,
      player: nextPlayer,
      enemies: nextEnemies,
      doors: nextDoors,
      objectives: nextObjectives,
    })

    // ----------------------------------------------------------------
    // 7. Render hints  (Raycaster + SpriteRenderer)
    // ----------------------------------------------------------------
    // These render to an offscreen canvas; GameViewportShape picks up
    // the result via its own subscription to gameStore.
    // Raycaster.render(nextPlayer, world)
    // SpriteRenderer.render(nextEnemies, nextPlayer)
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** True while the rAF loop is running. */
  get isRunning(): boolean {
    return this._running
  }
}

// ---------------------------------------------------------------------------
// Singleton export (optional -- callers may also instantiate directly)
// ---------------------------------------------------------------------------

export const game = new Game()
