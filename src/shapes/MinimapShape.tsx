/**
 * MinimapShape
 *
 * A custom tldraw `ShapeUtil` that renders the top-down minimap of the current
 * level, overlaying the player's position/direction arrow and enemy dots.
 *
 * The shape lives *outside* the game viewport on the tldraw canvas — it is a
 * fully draggable tldraw object that reads from the shared `gameStore`
 * singleton and redraws at ≤ 10 fps via a rAF-based throttle.
 *
 * Registration (in App.tsx):
 *   <Tldraw shapeUtils={[MinimapShapeUtil]} onMount={seedMinimap} />
 */

import { useEffect, useRef } from 'react'
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  T,
  type TLBaseBoxShape,
} from 'tldraw'
import { gameStore, type GameState } from '../store/gameStore'
import { CellType, getCell, LEVEL_1, WORLD_SIZE } from '../game/World'

// ---------------------------------------------------------------------------
// Module augmentation — register the shape type in tldraw's type system
// ---------------------------------------------------------------------------

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    minimap: MinimapShapeProps
  }
}

// ---------------------------------------------------------------------------
// Shape prop types
// ---------------------------------------------------------------------------

/** Props stored in the tldraw record for each minimap instance. */
export interface MinimapShapeProps {
  /** Width of the rendered canvas in CSS pixels (= tldraw canvas-units at zoom 1). */
  w: number
  /** Height of the rendered canvas in CSS pixels. */
  h: number
  /** World-grid cell size in pixels (default: 8). */
  cellSize: number
}

/** The full tldraw record type inferred from the module augmentation. */
export type MinimapShape = TLBaseBoxShape & {
  type: typeof MINIMAP_SHAPE_TYPE
  props: MinimapShapeProps
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MINIMAP_SHAPE_TYPE = 'minimap' as const

/** Minimap target refresh rate (frames per second). */
const MINIMAP_FPS = 10
const MINIMAP_FRAME_MS = 1000 / MINIMAP_FPS

// ---------------------------------------------------------------------------
// Cell colour palette
// ---------------------------------------------------------------------------

const CELL_COLORS: Record<CellType, string> = {
  [CellType.EMPTY]:        '#1a1a2e',
  [CellType.WALL]:         '#4a4a6a',
  [CellType.DOOR]:         '#c8a035',
  [CellType.PICKUP_SPAWN]: '#1a3a1a',
}

// ---------------------------------------------------------------------------
// Pure draw helper (no DOM deps — easy to unit-test)
// ---------------------------------------------------------------------------

/**
 * Render one minimap frame onto an existing `CanvasRenderingContext2D`.
 *
 * @param ctx       2D rendering context of the minimap canvas element.
 * @param state     Current game state snapshot from `gameStore`.
 * @param cellSize  Pixels per world tile (default: 8).
 */
export function drawMinimapFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cellSize = 8,
): void {
  const { player, enemies } = state
  const canvasW = ctx.canvas.width
  const canvasH = ctx.canvas.height

  ctx.clearRect(0, 0, canvasW, canvasH)
  ctx.fillStyle = '#111122'
  ctx.fillRect(0, 0, canvasW, canvasH)

  for (let row = 0; row < WORLD_SIZE; row++) {
    for (let col = 0; col < WORLD_SIZE; col++) {
      const cell = getCell(LEVEL_1, col, row)
      ctx.fillStyle = CELL_COLORS[cell as CellType] ?? CELL_COLORS[CellType.EMPTY]
      ctx.fillRect(col * cellSize, row * cellSize, cellSize - 1, cellSize - 1)
    }
  }

  for (const enemy of enemies) {
    if (enemy.status !== 'dead') continue
    ctx.fillStyle = '#666688'
    ctx.beginPath()
    ctx.arc(
      enemy.position.x * cellSize,
      enemy.position.y * cellSize,
      cellSize * 0.3, 0, Math.PI * 2,
    )
    ctx.fill()
  }

  for (const enemy of enemies) {
    if (enemy.status === 'dead') continue
    const ex = enemy.position.x * cellSize
    const ey = enemy.position.y * cellSize
    const color = enemy.status === 'attack' ? '#ff3333' : '#ff8844'

    if (enemy.status === 'alert' || enemy.status === 'attack') {
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(
        ex + Math.cos(enemy.angle) * cellSize * 0.7,
        ey + Math.sin(enemy.angle) * cellSize * 0.7,
      )
      ctx.stroke()
    }

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(ex, ey, cellSize * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }

  const px = player.position.x * cellSize
  const py = player.position.y * cellSize
  const arrowLen = cellSize * 1.4

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(
    px + Math.cos(player.angle) * arrowLen,
    py + Math.sin(player.angle) * arrowLen,
  )
  ctx.stroke()

  ctx.fillStyle = '#00ff88'
  ctx.beginPath()
  ctx.arc(px, py, cellSize * 0.45, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, canvasW, canvasH)
}

// ---------------------------------------------------------------------------
// Subscription helper
// ---------------------------------------------------------------------------

export function subscribeMinimapShape(
  onUpdate: (state: GameState) => void,
): () => void {
  return gameStore.subscribeWithInitial(onUpdate)
}

// ---------------------------------------------------------------------------
// ShapeUtil implementation
// ---------------------------------------------------------------------------

export class MinimapShapeUtil extends BaseBoxShapeUtil<MinimapShape> {
  static override type = MINIMAP_SHAPE_TYPE

  static override props = {
    w:        T.positiveNumber,
    h:        T.positiveNumber,
    cellSize: T.positiveNumber,
  }

  override getDefaultProps(): MinimapShapeProps {
    const cellSize = 8
    return {
      w:        WORLD_SIZE * cellSize,
      h:        WORLD_SIZE * cellSize,
      cellSize,
    }
  }

  override getGeometry(shape: MinimapShape) {
    return new Rectangle2d({
      width:    shape.props.w,
      height:   shape.props.h,
      isFilled: true,
    })
  }

  override getIndicatorPath(shape: MinimapShape): Path2D {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  override component(shape: MinimapShape) {
    const { w, h, cellSize } = shape.props
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const canvasRef = useRef<HTMLCanvasElement | null>(null)

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const dpr = Math.max(window.devicePixelRatio ?? 1, 1)
      canvas.width  = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width  = w + 'px'
      canvas.style.height = h + 'px'

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)

      let rafId  = 0
      let lastMs = 0
      let dirty  = true

      function tick(nowMs: number) {
        rafId = requestAnimationFrame(tick)
        if (!dirty && nowMs - lastMs < MINIMAP_FRAME_MS) return
        lastMs = nowMs
        dirty  = false
        drawMinimapFrame(ctx!, gameStore.getState(), cellSize)
      }

      rafId = requestAnimationFrame(tick)
      const unsub = gameStore.subscribe(() => { dirty = true })

      return () => {
        cancelAnimationFrame(rafId)
        unsub()
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [w, h, cellSize])

    return (
      <HTMLContainer
        id={shape.id}
        style={{ overflow: 'hidden', borderRadius: 4, pointerEvents: 'none' }}
      >
        <canvas ref={canvasRef} />
      </HTMLContainer>
    )
  }
}
