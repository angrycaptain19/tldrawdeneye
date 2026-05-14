/**
 * ObjectiveHUD
 *
 * In-game HUD overlay that:
 *  1. Lists all mission objectives (with a check tick when completed).
 *  2. Displays a centred "Objective complete!" toast notification whenever an
 *     objective is marked done (auto-dismisses after 3 s).
 *  3. Shows a full "MISSION COMPLETE" banner when all objectives are done.
 *
 * The component receives the ObjectiveSystem instance as a prop and subscribes
 * to its events directly, so it stays in sync without polling.
 *
 * Usage
 * ─────
 *   <ObjectiveHUD system={objectiveSystem} />
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ObjectiveSystem,
  ObjectiveState,
} from "../game/ObjectiveSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  system: ObjectiveSystem;
}

interface Toast {
  id: number;
  label: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ObjectiveHUD({ system }: Props) {
  // Snapshot of objective states (re-renders whenever something changes)
  const [objectives, setObjectives] = useState<ReadonlyArray<Readonly<ObjectiveState>>>(
    () => system.getObjectives()
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [missionComplete, setMissionComplete] = useState(system.isMissionComplete());
  const toastCounter = useRef(0);

  // Helper: dismiss a toast by its unique id after the delay
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    // Sync objective list whenever an objective completes
    const onObjectiveComplete = ({ objective }: { objective: ObjectiveState }) => {
      // Refresh the objectives array so the checkbox updates
      setObjectives(system.getObjectives());

      // Show a "Objective complete!" toast
      const id = ++toastCounter.current;
      setToasts((prev) => [...prev, { id, label: objective.definition.label }]);

      // Auto-dismiss after 3 s
      setTimeout(() => dismissToast(id), 3000);
    };

    const onMissionComplete = () => {
      setObjectives(system.getObjectives());
      setMissionComplete(true);
    };

    system.on("objective_complete", onObjectiveComplete);
    system.on("mission_complete", onMissionComplete);

    return () => {
      system.off("objective_complete", onObjectiveComplete);
      system.off("mission_complete", onMissionComplete);
    };
  }, [system, dismissToast]);

  return (
    <>
      {/* Objective list panel (top-left) */}
      <div style={styles.panel}>
        <div style={styles.panelTitle}>OBJECTIVES</div>
        {objectives.map((obj) => (
          <div key={obj.definition.id} style={styles.objectiveRow}>
            <span style={obj.completed ? styles.checkDone : styles.checkPending}>
              {obj.completed ? "+" : "o"}
            </span>
            <span
              style={{
                ...styles.objectiveLabel,
                ...(obj.completed ? styles.objectiveLabelDone : {}),
              }}
            >
              {obj.definition.label}
            </span>
          </div>
        ))}
      </div>

      {/* Objective complete toast notifications (centre-top) */}
      <div style={styles.toastContainer}>
        {toasts.map((toast) => (
          <div key={toast.id} style={styles.toast}>
            + Objective complete!
            <div style={styles.toastSub}>{toast.label}</div>
          </div>
        ))}
      </div>

      {/* Mission complete banner (full-screen overlay) */}
      {missionComplete && (
        <div style={styles.missionBanner}>
          <div style={styles.missionTitle}>MISSION COMPLETE</div>
          <div style={styles.missionSub}>All objectives achieved, Agent.</div>
        </div>
      )}
    </>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────
// Kept inline so the component is self-contained (no CSS file dependency).

const styles = {
  // Objective list panel
  panel: {
    position: "fixed" as const,
    top: 16,
    left: 16,
    background: "rgba(0, 0, 0, 0.65)",
    border: "1px solid rgba(255, 200, 0, 0.5)",
    borderRadius: 4,
    padding: "10px 14px",
    color: "#fff",
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 13,
    minWidth: 210,
    zIndex: 9000,
    pointerEvents: "none" as const,
    userSelect: "none" as const,
  },
  panelTitle: {
    fontSize: 11,
    letterSpacing: "0.15em",
    color: "#ffd700",
    marginBottom: 8,
    borderBottom: "1px solid rgba(255, 215, 0, 0.35)",
    paddingBottom: 4,
  },
  objectiveRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  checkPending: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    width: 14,
    flexShrink: 0,
  },
  checkDone: {
    color: "#4cff6e",
    fontSize: 14,
    width: 14,
    flexShrink: 0,
  },
  objectiveLabel: {
    color: "#e0e0e0",
  },
  objectiveLabelDone: {
    color: "rgba(255,255,255,0.4)",
    textDecoration: "line-through" as const,
  },

  // Toast container
  toastContainer: {
    position: "fixed" as const,
    top: 64,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
    zIndex: 9100,
    pointerEvents: "none" as const,
  },
  toast: {
    background: "rgba(0, 0, 0, 0.80)",
    border: "1px solid #4cff6e",
    borderRadius: 4,
    padding: "10px 22px",
    color: "#4cff6e",
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 16,
    fontWeight: "bold" as const,
    letterSpacing: "0.06em",
    textAlign: "center" as const,
    boxShadow: "0 0 12px rgba(76, 255, 110, 0.45)",
  },
  toastSub: {
    fontSize: 12,
    fontWeight: "normal" as const,
    color: "#a0ffc0",
    marginTop: 4,
    letterSpacing: "0.03em",
  },

  // Mission complete banner
  missionBanner: {
    position: "fixed" as const,
    inset: 0,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.72)",
    zIndex: 9200,
    pointerEvents: "none" as const,
  },
  missionTitle: {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 52,
    fontWeight: "bold" as const,
    letterSpacing: "0.18em",
    color: "#ffd700",
    textShadow: "0 0 30px rgba(255, 215, 0, 0.8), 0 2px 4px rgba(0,0,0,0.9)",
  },
  missionSub: {
    marginTop: 16,
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 18,
    color: "#e0e0e0",
    letterSpacing: "0.08em",
  },
} as const;
