/**
 * ObjectiveSystem
 *
 * Manages a list of mission objectives for a level, tracking completion state
 * and firing events when individual objectives are completed or when all
 * objectives in a level are finished (mission complete).
 *
 * Trigger types
 * ─────────────
 *   "proximity_interact" – player must be within `radius` units of a named
 *                          target point AND trigger `interact()`.
 *   "enemy_killed"       – a named enemy entity must be dead.
 *   "area_reached"       – player position must be inside an axis-aligned
 *                          rectangular zone.
 *
 * Usage
 * ─────
 *   const sys = new ObjectiveSystem(LEVEL_1_OBJECTIVES);
 *   sys.on('objective_complete', ({ objective }) => showHUD(objective.label));
 *   sys.on('mission_complete', () => endLevel());
 *
 *   // each game tick:
 *   sys.update({ playerPos, killedEnemyIds, interacting });
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** A 2-D position in world-space. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned bounding box zone trigger. */
export interface AreaZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Union of all trigger-condition variants. */
export type TriggerCondition =
  | {
      type: "proximity_interact";
      /** World-space target point the player must be near. */
      target: Vec2;
      /** Distance (in world units) at which the interaction becomes possible. */
      radius: number;
    }
  | {
      type: "enemy_killed";
      /** Unique string id of the enemy entity that must be killed. */
      enemyId: string;
    }
  | {
      type: "area_reached";
      /** Rectangular zone the player must enter. */
      zone: AreaZone;
    };

/** A single mission objective definition. */
export interface ObjectiveDefinition {
  /** Unique id used internally. */
  id: string;
  /** Human-readable label shown in the HUD. */
  label: string;
  /** What must happen to complete this objective. */
  trigger: TriggerCondition;
}

/** Runtime state of one objective. */
export interface ObjectiveState {
  definition: ObjectiveDefinition;
  completed: boolean;
  /** Wall-clock timestamp (ms) when completed, or null if still pending. */
  completedAt: number | null;
}

/** Snapshot passed to `update()` each tick. */
export interface GameSnapshot {
  /** Current player world-space position. */
  playerPos: Vec2;
  /** Set of enemy ids that have been killed (ever, not just this tick). */
  killedEnemyIds: ReadonlySet<string>;
  /** True when the player pressed the interact key this tick. */
  interacting: boolean;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export interface ObjectiveCompleteEvent {
  objective: ObjectiveState;
}

export interface MissionCompleteEvent {
  completedAt: number;
}

type EventMap = {
  objective_complete: ObjectiveCompleteEvent;
  mission_complete: MissionCompleteEvent;
};

type Listener<E> = (event: E) => void;

// ─── Pre-built level objective lists ─────────────────────────────────────────

/**
 * Level 1 – Facility
 * Three canonical GoldenEye objectives.
 */
export const LEVEL_1_OBJECTIVES: ObjectiveDefinition[] = [
  {
    id: "destroy_server",
    label: "Destroy server",
    trigger: {
      type: "proximity_interact",
      target: { x: 24, y: 8 },
      radius: 1.5,
    },
  },
  {
    id: "eliminate_natalya",
    label: "Eliminate Natalya",
    trigger: {
      type: "enemy_killed",
      enemyId: "natalya",
    },
  },
  {
    id: "escape_helicopter_pad",
    label: "Escape via helicopter pad",
    trigger: {
      type: "area_reached",
      zone: { x: 30, y: 2, width: 4, height: 4 },
    },
  },
];

/**
 * Level 2 – Bunker
 * An alternative set for a second level.
 */
export const LEVEL_2_OBJECTIVES: ObjectiveDefinition[] = [
  {
    id: "download_data",
    label: "Download mainframe data",
    trigger: {
      type: "proximity_interact",
      target: { x: 16, y: 20 },
      radius: 1.5,
    },
  },
  {
    id: "neutralise_general",
    label: "Neutralise the General",
    trigger: {
      type: "enemy_killed",
      enemyId: "general",
    },
  },
  {
    id: "reach_extraction",
    label: "Reach extraction point",
    trigger: {
      type: "area_reached",
      zone: { x: 1, y: 1, width: 3, height: 3 },
    },
  },
];

// ─── ObjectiveSystem class ────────────────────────────────────────────────────

export class ObjectiveSystem {
  private readonly objectives: ObjectiveState[];
  private missionCompleted = false;

  // Typed listener registry
  private readonly listeners: {
    [K in keyof EventMap]?: Array<Listener<EventMap[K]>>;
  } = {};

  constructor(definitions: ObjectiveDefinition[]) {
    if (definitions.length === 0) {
      throw new Error("ObjectiveSystem requires at least one objective.");
    }
    this.objectives = definitions.map((def) => ({
      definition: def,
      completed: false,
      completedAt: null,
    }));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Subscribe to an objective system event.
   *
   * @example
   * sys.on('objective_complete', ({ objective }) =>
   *   console.log(objective.definition.label + ' complete!'));
   */
  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as Array<Listener<EventMap[K]>>).push(listener);
    return this;
  }

  /**
   * Remove a previously registered listener.
   */
  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    const bucket = this.listeners[event] as Array<Listener<EventMap[K]>> | undefined;
    if (bucket) {
      const idx = bucket.indexOf(listener);
      if (idx !== -1) bucket.splice(idx, 1);
    }
    return this;
  }

  /**
   * Call once per game tick with the current game snapshot.
   * Checks each incomplete objective's trigger condition and fires events.
   */
  update(snapshot: GameSnapshot): void {
    if (this.missionCompleted) return;

    for (const obj of this.objectives) {
      if (obj.completed) continue;

      if (this.evaluateTrigger(obj.definition.trigger, snapshot)) {
        this.completeObjective(obj);
      }
    }

    if (this.objectives.every((o) => o.completed)) {
      this.completeMission();
    }
  }

  /**
   * Returns a read-only snapshot of every objective's current state.
   */
  getObjectives(): ReadonlyArray<Readonly<ObjectiveState>> {
    return this.objectives;
  }

  /**
   * Returns true once all objectives have been completed.
   */
  isMissionComplete(): boolean {
    return this.missionCompleted;
  }

  /**
   * Programmatically force-complete an objective by id (useful for cutscenes,
   * scripted events, or testing).
   */
  forceComplete(objectiveId: string): void {
    const obj = this.objectives.find((o) => o.definition.id === objectiveId);
    if (!obj) {
      throw new Error(`ObjectiveSystem: unknown objective id "${objectiveId}"`);
    }
    if (obj.completed) return;
    this.completeObjective(obj);
    if (this.objectives.every((o) => o.completed)) {
      this.completeMission();
    }
  }

  /**
   * Reset all objectives to their initial (incomplete) state.
   * Useful when restarting a level or running tests.
   */
  reset(): void {
    for (const obj of this.objectives) {
      obj.completed = false;
      obj.completedAt = null;
    }
    this.missionCompleted = false;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private evaluateTrigger(trigger: TriggerCondition, snap: GameSnapshot): boolean {
    switch (trigger.type) {
      case "proximity_interact": {
        const dist = distance(snap.playerPos, trigger.target);
        return dist <= trigger.radius && snap.interacting;
      }
      case "enemy_killed": {
        return snap.killedEnemyIds.has(trigger.enemyId);
      }
      case "area_reached": {
        return pointInZone(snap.playerPos, trigger.zone);
      }
    }
  }

  private completeObjective(obj: ObjectiveState): void {
    obj.completed = true;
    obj.completedAt = Date.now();
    this.emit("objective_complete", { objective: obj });
  }

  private completeMission(): void {
    this.missionCompleted = true;
    this.emit("mission_complete", { completedAt: Date.now() });
  }

  private emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const bucket = this.listeners[event] as Array<Listener<EventMap[K]>> | undefined;
    if (bucket) {
      for (const listener of bucket.slice()) {
        listener(payload);
      }
    }
  }
}

// ─── Pure geometry helpers ────────────────────────────────────────────────────

function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pointInZone(p: Vec2, z: AreaZone): boolean {
  return p.x >= z.x && p.x <= z.x + z.width && p.y >= z.y && p.y <= z.y + z.height;
}
