import { Tldraw } from 'tldraw'

/**
 * App – renders a bare tldraw canvas.
 *
 * Custom shapes (GameViewportShape, MinimapShape) and game logic will be wired
 * in once the individual modules are ready.  For now this just confirms the
 * tldraw shell loads correctly.
 */
export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw />
    </div>
  )
}
