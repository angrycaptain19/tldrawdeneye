import { useRef } from "react";
import { Tldraw, type Editor } from "tldraw";
import { ObjectiveSystem, LEVEL_1_OBJECTIVES } from "../game/ObjectiveSystem";
import { ObjectiveHUD } from "./ObjectiveHUD";
import { MinimapShapeUtil, MINIMAP_SHAPE_TYPE } from "../shapes/MinimapShape";

/**
 * App – renders a tldraw canvas with a mission objective HUD overlay
 * and a draggable minimap shape placed to the right of the viewport.
 *
 * The ObjectiveSystem is instantiated once (via useRef) so it is stable across
 * re-renders. In a full game loop the system's `update()` method would be
 * called each tick; here we also expose `window.__objectiveSystem` so the
 * system can be exercised from the browser console during development.
 *
 * Example dev console commands:
 *   __objectiveSystem.forceComplete('destroy_server')
 *   __objectiveSystem.forceComplete('eliminate_natalya')
 *   __objectiveSystem.forceComplete('escape_helicopter_pad')
 */

// Augment window for the dev helper (type-safe but optional)
declare global {
  interface Window {
    __objectiveSystem?: ObjectiveSystem;
  }
}

/** Shape utils to register with tldraw (in addition to the built-in set). */
const CUSTOM_SHAPE_UTILS = [MinimapShapeUtil];

/**
 * Called once when the tldraw editor mounts.
 * Creates a single MinimapShape to the right of the default viewport so the
 * player can immediately see the minimap without needing to drag one in.
 */
function seedMinimap(editor: Editor): void {
  // Only create if no minimap shape exists yet (avoids duplicates on HMR).
  const existing = editor
    .getCurrentPageShapes()
    .find((s) => s.type === MINIMAP_SHAPE_TYPE);
  if (existing) return;

  const cellSize = 8;
  const gridSize = 24; // WORLD_SIZE
  const mapPx = cellSize * gridSize; // 192 px

  // Place the minimap 40 px to the right of the initial viewport
  editor.createShape({
    type: MINIMAP_SHAPE_TYPE,
    x: window.innerWidth + 40,
    y: 40,
    props: { w: mapPx, h: mapPx, cellSize },
  });
}

export default function App() {
  const systemRef = useRef<ObjectiveSystem | null>(null);
  if (!systemRef.current) {
    systemRef.current = new ObjectiveSystem(LEVEL_1_OBJECTIVES);
    // Expose to browser console during development
    if (typeof window !== "undefined") {
      window.__objectiveSystem = systemRef.current;
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw shapeUtils={CUSTOM_SHAPE_UTILS} onMount={seedMinimap} />
      <ObjectiveHUD system={systemRef.current} />
    </div>
  );
}
