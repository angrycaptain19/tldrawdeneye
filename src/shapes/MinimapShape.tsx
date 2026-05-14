/**
 * MinimapShape
 *
 * A custom tldraw ShapeUtil that renders the 24x24 world grid as a
 * top-down minimap.  It lives outside the game viewport on the tldraw
 * canvas as a regular, draggable tldraw shape that draws itself onto
 * an HTML canvas element.
 *
 * Visual elements:
 *   - Grid cells     – coloured squares (wall / door / pickup / empty)
 *   - Player marker  – bright green dot + direction arrow
 *   - Enemy markers  – red dots (grey when dead)
 *   - Border         – 2-px dark outline around the entire minimap
 *
 * Architecture:
 *   - Props: cellSize (pixels per grid cell) and showEnemies (bool).
 *   - Rendering is done in a React component using useState + useEffect,
 *     requesting redraws via requestAnimationFrame at <= 10 fps.
 *   - Module augmentation declares the shape type to TypeScript.
 */

import { useEffect, useRef, useState } from 'react'
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  T,
  type TLBaseShape,
  type TLResizeInfo,
} from 'tldraw'
import { CellType, LEVEL_1, WORLD_SIZE, getCell } from '../game/World'
import { gameStore } from '../store/gameStore'

// ---------------------------------------------------------------------------
// Module augmentation – registers 'minimap' with the tldraw type system
// ---------------------------------------------------------------------------

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    minimap: MinimapShapeProps
  }
}

// ---------------------------------------------------------------------------
// Props schema
// ---------------------------------------------------------------------------

/** Props stored on the tldraw shape record. */
export interface MinimapShapeProps {
  /** Pixel width/height of each grid cell on the rendered canvas. */
  cellSize: number
  /** When true, enemy markers are drawn over the grid. */
  showEnemies: boolean
  /** Canvas width in pixels (= cellSize * WORLD_SIZE). */
  w: number
  /** Canvas height in pixels (= cellSize * WORLD_SIZE). */
  h: number
}

/** Fully-typed tldraw shape record for the minimap. */
export type TLMinimapShape = TLBaseShape<'minimap', MinimapShapeProps>

// ---------------------------------------------------------------------------
// Prop validators (required by tldraw for serialisation)
// ---------------------------------------------------------------------------

export const minimapShapeProps: Record<keyof MinimapShapeProps, T.Validatable<unknown>> = {
  cellSize:    T.number,
  showEnemies: T.boolean,
  w:           T.number,
  h:           T.number,
}

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const COLORS = {
  EMPTY:        '#1a1a2e',
  WALL:         '#4a4a6a',
  DOOR:         '#8b5e3c',
  PICKUP_SPAWN: '#2d6a4f',
  PLAYER:       '#00ff88',
  PLAYER_ARROW: '#ffffff',
  ENEMY_ALIVE:  '#ff3333',
  ENEMY_DEAD:   '#555555',
  BORDER:       '#000000',
} as const

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function drawGrid(ctx: CanvasRenderingContext2D, cellSize: number): void {
  for (let row = 0; row < WORLD_SIZE; row++) {
    for (let col = 0; col < WORLD_SIZE; col++) {
      const cell = getCell(LEVEL_1, col, row)
      switch (cell) {
        case CellType.WALL:         ctx.fillStyle = COLORS.WALL;         break
        case CellType.DOOR:         ctx.fillStyle = COLORS.DOOR;         break
        case CellType.PICKUP_SPAWN: ctx.fillStyle = COLORS.PICKUP_SPAWN; break
        default:                    ctx.fillStyle = COLORS.EMPTY;        break
      }
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
    }
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, angle: number,
  cellSize: number,
): void {
  const cx = (px + 0.5) * cellSize
  const cy = (py + 0.5) * cellSize
  const radius = Math.max(2, cellSize * 0.35)

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.PLAYER
  ctx.fill()

  const arrowLen = cellSize * 0.9
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(angle) * arrowLen, cy + Math.sin(angle) * arrowLen)
  ctx.strokeStyle = COLORS.PLAYER_ARROW
  ctx.lineWidth = Math.max(1, cellSize * 0.15)
  ctx.lineCap = 'round'
  ctx.stroke()
}

function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: { x: number; y: number; dead: boolean }[],
  cellSize: number,
): void {
  const radius = Math.max(1.5, cellSize * 0.25)
  for (const e of enemies) {
    ctx.beginPath()
    ctx.arc((e.x + 0.5) * cellSize, (e.y + 0.5) * cellSize, radius, 0, Math.PI * 2)
    ctx.fillStyle = e.dead ? COLORS.ENEMY_DEAD : COLORS.ENEMY_ALIVE
    ctx.fill()
  }
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

const TARGET_FPS = 10
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS

function MinimapCanvas({ shape }: { shape: TLMinimapShape }) {
  const { cellSize, showEnemies, w, h } = shape.props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [_tick, setTick] = useState(() => gameStore.getState().tick)

  // Subscribe to gameStore updates, throttled to TARGET_FPS.
  useEffect(() => {
    let lastRender = 0
    let rafId = 0
    let pending = false

    const scheduleRepaint = () => {
      if (pending) return
      pending = true
      rafId = requestAnimationFrame((now) => {
        pending = false
        if (now - lastRender >= FRAME_INTERVAL_MS) {
          lastRender = now
          setTick(gameStore.getState().tick)
        } else {
          const remaining = FRAME_INTERVAL_MS - (now - lastRender)
          rafId = window.setTimeout(() => {
            setTick(gameStore.getState().tick)
            lastRender = performance.now()
          }, remaining) as unknown as number
        }
      })
    }

    const unsub = gameStore.subscribe(scheduleRepaint)
    return () => {
      unsub()
      cancelAnimationFrame(rafId)
      clearTimeout(rafId)
    }
  }, [])

  // Repaint the canvas whenever _tick changes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, w, h)

    drawGrid(ctx, cellSize)

    const state = gameStore.getState()
    if (showEnemies) drawEnemies(ctx, state.enemies, cellSize)
    drawPlayer(ctx, state.player.x, state.player.y, state.player.angle, cellSize)

    ctx.strokeStyle = COLORS.BORDER
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, w - 2, h - 2)
  }, [_tick, cellSize, showEnemies, w, h])

  return (
    <HTMLContainer
      style={{ width: w, height: h, overflow: 'hidden', pointerEvents: 'none', userSelect: 'none' }}
    >
      <canvas ref={canvasRef} width={w} height={h} style={{ display: 'block', width: w, height: h }} />
    </HTMLContainer>
  )
}

// ---------------------------------------------------------------------------
// ShapeUtil
// ---------------------------------------------------------------------------

/**
 * MinimapShapeUtil – the tldraw shape util that manages TLMinimapShape records.
 *
 * Register it in the Tldraw shapeUtils prop:
 *
 * ```tsx
 * <Tldraw shapeUtils={[MinimapShapeUtil]} />
 * ```
 */
export class MinimapShapeUtil extends BaseBoxShapeUtil<TLMinimapShape> {
  static override type = 'minimap' as const
  static override props = minimapShapeProps

  override getDefaultProps(): MinimapShapeProps {
    const cellSize = 8
    const side = cellSize * WORLD_SIZE
    return { cellSize, showEnemies: true, w: side, h: side }
  }

  override getGeometry(shape: TLMinimapShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: TLMinimapShape, info: TLResizeInfo<TLMinimapShape>) {
    const newW = Math.max(WORLD_SIZE, info.initialBounds.w * info.scaleX)
    const newCellSize = Math.max(1, Math.round(newW / WORLD_SIZE))
    const snappedSide = newCellSize * WORLD_SIZE
    return { ...shape, props: { ...shape.props, cellSize: newCellSize, w: snappedSide, h: snappedSide } }
  }

  override component(shape: TLMinimapShape) {
    return <MinimapCanvas shape={shape} />
  }

  override getIndicatorPath(shape: TLMinimapShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }

  override canResize() { return true }
  override canBind()   { return false }
}
