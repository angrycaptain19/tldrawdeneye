import { useRef } from "react";
import { Tldraw } from "tldraw";
import { ObjectiveSystem, LEVEL_1_OBJECTIVES } from "../game/ObjectiveSystem";
import { ObjectiveHUD } from "./ObjectiveHUD";

/**
 * App – renders a tldraw canvas with a mission objective HUD overlay.
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
      <Tldraw />
      <ObjectiveHUD system={systemRef.current} />
    </div>
  );
}
