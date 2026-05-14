import { useEffect } from 'react'
import {
  Tldraw,
  createShapeId,
  type Editor,
} from 'tldraw'
import { MinimapShapeUtil } from '../shapes/MinimapShape'
import { WORLD_SIZE } from '../game/World'

/**
 * Custom shape utils registered with tldraw.
 *
 * GameViewportShape will be added here once it is implemented.
 */
const CUSTOM_SHAPE_UTILS = [MinimapShapeUtil]

/** Stable shape id so we only ever create one minimap instance. */
const MINIMAP_ID = createShapeId('minimap')

/**
 * Seed the canvas with a minimap shape on first mount.
 * The shape is placed at (20, 20) with a comfortable 8 px/cell default size
 * (192x192 px for a 24x24 grid).
 */
function onEditorMount(editor: Editor) {
  // If the shape already exists (e.g. from a persisted snapshot) don't duplicate it.
  if (editor.getShape(MINIMAP_ID)) return

  const cellSize = 8
  const side = cellSize * WORLD_SIZE

  editor.createShape({
    id: MINIMAP_ID,
    type: 'minimap',
    x: 20,
    y: 20,
    props: {
      cellSize,
      showEnemies: true,
      w: side,
      h: side,
    },
  })
}

/**
 * App – renders a tldraw canvas with the MinimapShape registered.
 *
 * The GameViewportShape and game-loop wiring will be added in subsequent
 * tasks once those modules are ready.
 */
export default function App() {
  useEffect(() => {
    // No-op placeholder: the gameStore already has demo enemies from its
    // default state. Real game-loop integration happens in a later task.
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        shapeUtils={CUSTOM_SHAPE_UTILS}
        onMount={onEditorMount}
      />
    </div>
  )
}
