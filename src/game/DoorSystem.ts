/**
 * DoorSystem
 *
 * Manages every door tile (CellType.DOOR = 2) in the world grid.
 *
 * Behaviour:
 *  - Scans WorldData at construction and registers every DOOR cell.
 *  - Each door has an `offset` in [0,1]: 0=closed, 1=fully open.
 *  - Player within 1.5 cells + E key press → door starts opening.
 *  - Opening animation: offset ramps to 1 over 0.6 s.
 *  - Auto-close after 4 s of being open (if player is not blocking).
 *  - Closing animation: offset ramps back to 0 at same speed.
 *  - isSolidForRay / isSolidForMovement: blocks while offset < 1.
 *  - getDoorOffset: exposes slide amount for renderer.
 */

import { type WorldData, CellType, getCell } from './World.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Seconds to travel from fully closed to fully open (and vice-versa). */
export const OPEN_DURATION_S = 0.6;

/** Slide speed in offset-units per second. */
const SLIDE_SPEED = 1 / OPEN_DURATION_S;

/** Maximum interaction distance in world-cells (centre-to-centre). */
export const INTERACT_RADIUS = 1.5;

/** Seconds a door stays open before auto-closing (when not blocked). */
export const AUTO_CLOSE_WAIT_S = 4.0;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const enum DoorPhase {
  CLOSED  = 'closed',
  OPENING = 'opening',
  OPEN    = 'open',
  CLOSING = 'closing',
}

export interface DoorState {
  readonly gridX: number;
  readonly gridY: number;
  offset: number;
  phase: DoorPhase;
  /** Elapsed seconds since the door reached fully-open state. */
  openTimer: number;
}

/** Minimal player state needed by DoorSystem. */
export interface DoorSystemPlayerState {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// DoorSystem class
// ---------------------------------------------------------------------------

export class DoorSystem {
  private readonly _doors = new Map<string, DoorState>();
  private readonly _world: WorldData;
  private _ePressedLastFrame = false;

  constructor(world: WorldData) {
    this._world = world;
    for (let y = 0; y < world.size; y++) {
      for (let x = 0; x < world.size; x++) {
        if (getCell(world, x, y) === CellType.DOOR) {
          this._doors.set(DoorSystem._key(x, y), {
            gridX: x,
            gridY: y,
            offset: 0,
            phase: DoorPhase.CLOSED,
            openTimer: 0,
          });
        }
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private static _key(x: number, y: number): string {
    return `${x},${y}`;
  }

  // ── Update ───────────────────────────────────────────────────────────────

  /**
   * Advance door animations and handle the E-key interaction trigger.
   *
   * @param dt        Delta-time in seconds.
   * @param player    Current player world-space position (in cells).
   * @param eKeyDown  Whether the E key is currently held.
   */
  update(dt: number, player: DoorSystemPlayerState, eKeyDown: boolean): void {
    const eJustPressed = eKeyDown && !this._ePressedLastFrame;
    this._ePressedLastFrame = eKeyDown;

    for (const door of this._doors.values()) {
      // Distance from player to door centre.
      const dx = player.x - (door.gridX + 0.5);
      const dy = player.y - (door.gridY + 0.5);
      const withinRadius =
        dx * dx + dy * dy <= INTERACT_RADIUS * INTERACT_RADIUS;

      // Trigger open on E press when player is close enough.
      if (
        eJustPressed &&
        withinRadius &&
        (door.phase === DoorPhase.CLOSED || door.phase === DoorPhase.CLOSING)
      ) {
        door.phase = DoorPhase.OPENING;
        door.openTimer = 0;
      }

      // Animate.
      switch (door.phase) {
        case DoorPhase.OPENING:
          door.offset = Math.min(1, door.offset + SLIDE_SPEED * dt);
          if (door.offset >= 1) {
            door.offset = 1;
            door.phase = DoorPhase.OPEN;
            door.openTimer = 0;
          }
          break;

        case DoorPhase.OPEN: {
          // Block auto-close if player is standing inside the door cell.
          const playerBlocking =
            Math.floor(player.x) === door.gridX &&
            Math.floor(player.y) === door.gridY;

          if (playerBlocking) {
            door.openTimer = 0;
          } else {
            door.openTimer += dt;
            if (door.openTimer >= AUTO_CLOSE_WAIT_S) {
              door.phase = DoorPhase.CLOSING;
              door.openTimer = 0;
            }
          }
          break;
        }

        case DoorPhase.CLOSING:
          door.offset = Math.max(0, door.offset - SLIDE_SPEED * dt);
          if (door.offset <= 0) {
            door.offset = 0;
            door.phase = DoorPhase.CLOSED;
          }
          break;

        case DoorPhase.CLOSED:
          // Nothing to animate.
          break;
      }
    }
  }

  // ── Raycaster / movement queries ─────────────────────────────────────────

  /**
   * Returns `true` when the door at (x, y) should block a raycaster ray.
   * A door blocks while its offset is less than 1 (not fully open).
   * Returns `false` for non-door cells so callers can fall through to the
   * normal grid solidity check.
   */
  isSolidForRay(x: number, y: number): boolean {
    const door = this._doors.get(DoorSystem._key(x, y));
    return door !== undefined ? door.offset < 1 : false;
  }

  /**
   * Returns `true` when the door at (x, y) blocks player / enemy movement.
   * Identical to isSolidForRay — passage only allowed when fully open.
   */
  isSolidForMovement(x: number, y: number): boolean {
    return this.isSolidForRay(x, y);
  }

  /**
   * Returns the slide offset of the door at (x, y) in [0, 1], or `null`
   * if the cell is not a registered door.
   *
   * 0 = fully closed, 1 = fully open.  The renderer uses this to draw a
   * partial wall stripe that slides to the side as the door opens.
   */
  getDoorOffset(x: number, y: number): number | null {
    const door = this._doors.get(DoorSystem._key(x, y));
    return door !== undefined ? door.offset : null;
  }

  /**
   * Returns the full DoorState for the door at (x, y), or `null`.
   * Useful for the minimap renderer and debug overlays.
   */
  getDoorState(x: number, y: number): DoorState | null {
    return this._doors.get(DoorSystem._key(x, y)) ?? null;
  }

  /** Iterable of all registered DoorState entries (for minimap etc.). */
  allDoors(): IterableIterator<DoorState> {
    return this._doors.values();
  }

  /** Total number of registered doors. */
  get doorCount(): number {
    return this._doors.size;
  }

  // ── Composite solidity check ─────────────────────────────────────────────

  /**
   * Door-aware drop-in for World.isSolid().
   *
   * For door cells: returns the live solidity based on animation offset.
   * For all other cells: delegates to the world grid.
   *
   * Player collision and EnemySystem should call this instead of
   * World.isSolid() so that fully-open doors are passable.
   */
  isSolid(x: number, y: number): boolean {
    const door = this._doors.get(DoorSystem._key(x, y));
    if (door !== undefined) {
      return door.offset < 1;
    }
    const cell = getCell(this._world, x, y);
    return cell === CellType.WALL || cell === CellType.DOOR;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a DoorSystem bound to the given WorldData.
 *
 * @example
 * ```ts
 * import { LEVEL_1 } from './World.js';
 * import { createDoorSystem } from './DoorSystem.js';
 *
 * const doors = createDoorSystem(LEVEL_1);
 *
 * // Game loop:
 * doors.update(dt, { x: player.x, y: player.y }, input.isDown('KeyE'));
 *
 * // Raycaster — check before the normal isSolid call:
 * if (doors.isSolidForRay(cellX, cellY)) { ... }
 * const slideOffset = doors.getDoorOffset(cellX, cellY); // null = not a door
 * ```
 */
export function createDoorSystem(world: WorldData): DoorSystem {
  return new DoorSystem(world);
}
