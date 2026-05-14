/**
 * MinimapShape
 *
 * Custom tldraw ShapeUtil that renders the top-down minimap of the current
 * level, overlaying the player position and visible enemy locations.
 *
 * This stub wires the shape to the shared gameStore so the minimap can
 * redraw whenever player/enemy positions change -- without polling or touching
 * the tldraw store.
 *
 * TODO: implement full ShapeUtil subclass with canvas-based minimap rendering.
 */

import { gameStore, type GameState } from '../store/gameStore'

// ---------------------------------------------------------------------------
// Shape props type (used when the full ShapeUtil is implemented)
// ---------------------------------------------------------------------------

export interface MinimapShapeProps {
  /** Width of the minimap panel in tldraw canvas units */
  w: number
  /** Height of the minimap panel in tldraw canvas units */
  h: number
  /** Cell size in pixels (how many px per world tile) */
  cellSize: number
}

// ---------------------------------------------------------------------------
// Subscription helper
// ---------------------------------------------------------------------------

/**
 * Subscribe the minimap to the game store.
 * Returns an unsubscribe function.
 *
 * Call this in the ShapeUtil component() lifecycle (e.g. a useEffect):
 *
 * @example
 * const canvasRef = useRef<HTMLCanvasElement>(null)
 *
 * useEffect(() => {
 *   return subscribeMinimapShape((state) => {
 *     const ctx = canvasRef.current?.getContext('2d')
 *     if (!ctx) return
 *     drawMinimapFrame(ctx, state)
 *   })
 * }, [])
 */
export function subscribeMinimapShape(
  onUpdate: (state: GameState) => void,
): () => void {
  return gameStore.subscribeWithInitial(onUpdate)
}

// ---------------------------------------------------------------------------
// Minimap draw helper (pure, no DOM deps -- easy to unit-test)
// ---------------------------------------------------------------------------

/**
 * Render a single minimap frame onto an existing CanvasRenderingContext2D.
 *
 * @param ctx       2D context of the minimap canvas element.
 * @param state     Current game state snapshot from gameStore.
 * @param cellSize  Pixels per world tile (default: 8).
 */
export function drawMinimapFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cellSize = 8,
): void {
  const { player, enemies } = state

  // Clear
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // -- Player dot -----------------------------------------------------------
  const px = player.position.x * cellSize
  const py = player.position.y * cellSize

  // Direction indicator
  ctx.strokeStyle = '#00ff88'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(
    px + Math.cos(player.angle) * cellSize * 1.2,
    py + Math.sin(player.angle) * cellSize * 1.2,
  )
  ctx.stroke()

  // Player circle
  ctx.fillStyle = '#00ff88'
  ctx.beginPath()
  ctx.arc(px, py, 3, 0, Math.PI * 2)
  ctx.fill()

  // -- Enemy dots -----------------------------------------------------------
  for (const enemy of enemies) {
    if (enemy.status === 'dead') continue

    const ex = enemy.position.x * cellSize
    const ey = enemy.position.y * cellSize

    ctx.fillStyle = enemy.status === 'attack' ? '#ff3333' : '#ffaa00'
    ctx.beginPath()
    ctx.arc(ex, ey, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ---------------------------------------------------------------------------
// Placeholder class (will become a tldraw ShapeUtil subclass)
// ---------------------------------------------------------------------------

/**
 * Lightweight placeholder so the module is importable and the subscription
 * contract is exercised even before the full ShapeUtil is built.
 */
export class MinimapShape {
  private _unsub: (() => void) | null = null

  /**
   * Attach the minimap to the game store.  Call once when the shape mounts.
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
