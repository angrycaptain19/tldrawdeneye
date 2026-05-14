/**
 * Player
 *
 * Manages the first-person player state:
 *   - World-space position (x, y in cell units, e.g. 12.5 = middle of cell 12)
 *   - View direction as a unit vector (dirX, dirY)
 *   - Camera plane vector perpendicular to the direction (for the raycaster)
 *   - WASD movement with configurable forward/strafe speed
 *   - Mouse-look via the Pointer Lock API (consumeMouseDelta from Input)
 *   - AABB sliding collision against any solid cell in the world grid
 *   - Health and ammo (state tracked here; game logic lives in Game.ts)
 *
 * Usage in the game loop:
 * ```ts
 * const player = new Player(startX, startY, startAngle);
 * // each frame:
 * player.update(dt, world);
 * // read back:
 * const { x, y, dirX, dirY, planeX, planeY } = player;
 * ```
 *
 * Coordinate system
 * -----------------
 * World space uses a standard right-hand grid where:
 *   +x -> right (east)
 *   +y -> down  (south)
 * Cell (cx, cy) occupies the unit square [cx, cx+1) x [cy, cy+1).
 * The player AABB is a square centred on (x, y) with half-extent PLAYER_RADIUS
 * on each axis.
 */

import { Input } from "../engine/Input.ts";
import { isSolid, type WorldData } from "./World.ts";

// ---------------------------------------------------------------------------
// Physical constants
// ---------------------------------------------------------------------------

/**
 * Half-width / half-height of the player's axis-aligned bounding box (in cell
 * units).  0.25 gives a comfortable clearance in 1-cell-wide corridors without
 * the player feeling too "thin".
 */
export const PLAYER_RADIUS = 0.25 as const;

/** Forward / backward movement speed in cells per second. */
export const MOVE_SPEED = 3.5 as const;

/** Strafe speed in cells per second (same as forward for isotropic feel). */
export const STRAFE_SPEED = 3.5 as const;

/**
 * Mouse-look rotation speed in radians per pixel of raw mouse movement.
 * A value of 0.002 rad/px feels roughly equivalent to a 360/800-count
 * desktop sensitivity.
 */
export const LOOK_SENSITIVITY = 0.002 as const;

// ---------------------------------------------------------------------------
// Helper: rotate a 2-D vector by `angle` radians (counter-clockwise in math
// coords, which means clockwise in screen-space because +y is down).
// ---------------------------------------------------------------------------
function rotate(vx: number, vy: number, angle: number): [number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [vx * cos - vy * sin, vx * sin + vy * cos];
}

// ---------------------------------------------------------------------------
// Helper: AABB-vs-world sliding collision
// ---------------------------------------------------------------------------

/**
 * Returns true if the AABB centred at (cx, cy) with half-extent `r` on each
 * axis overlaps any solid cell in `world`.
 *
 * We iterate every cell whose unit square intersects the AABB extent range.
 */
function overlapsSolid(
  cx: number,
  cy: number,
  r: number,
  world: WorldData,
): boolean {
  const x0 = Math.floor(cx - r);
  const x1 = Math.floor(cx + r);
  const y0 = Math.floor(cy - r);
  const y1 = Math.floor(cy + r);

  for (let row = y0; row <= y1; row++) {
    for (let col = x0; col <= x1; col++) {
      if (isSolid(world, col, row)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Attempt to move the AABB centred at (px, py) by (dx, dy) through the world
 * grid.  Uses separated-axis sliding:
 *
 *   1. Apply dx; reject if the new AABB overlaps a solid cell.
 *   2. Apply dy; reject if the new AABB overlaps a solid cell.
 *
 * This means the player glides along walls rather than stopping dead.
 *
 * @returns The resolved [x, y] position.
 */
function slideMove(
  px: number,
  py: number,
  dx: number,
  dy: number,
  world: WorldData,
): [number, number] {
  const r = PLAYER_RADIUS;

  const nx = px + dx;
  if (!overlapsSolid(nx, py, r, world)) {
    px = nx;
  }

  const ny = py + dy;
  if (!overlapsSolid(px, ny, r, world)) {
    py = ny;
  }

  return [px, py];
}

// ---------------------------------------------------------------------------
// Player class
// ---------------------------------------------------------------------------

export class Player {
  // -- Position & orientation ------------------------------------------------

  /** World-space X position (column, in cell units). */
  x: number;
  /** World-space Y position (row, in cell units). */
  y: number;

  /**
   * Unit direction vector -- the direction the player is looking.
   * Initialised pointing east (+x) then rotated by initialAngle.
   */
  dirX: number;
  dirY: number;

  /**
   * Camera plane vector, always perpendicular to (dirX, dirY) and scaled so
   * that |plane| / |dir| = tan(FOV/2).  For a 66 degree horizontal FOV the
   * magnitude is ~0.66.
   *
   * The raycaster uses this to compute per-column ray directions:
   *   rayDir = dir + plane * cameraX   (cameraX in [-1, 1])
   */
  planeX: number;
  planeY: number;

  // -- Game state ------------------------------------------------------------

  /** Current health points (0 = dead). */
  health: number;

  /** Remaining ammo for the current weapon. */
  ammo: number;

  // -- Constructor -----------------------------------------------------------

  /**
   * @param startX       Initial X position in world (cell) units.
   * @param startY       Initial Y position in world (cell) units.
   * @param initialAngle Initial view angle in radians.  0 = looking east (+x);
   *                     angles increase clockwise (screen-space, +y down).
   *                     Defaults to south-facing (Math.PI / 2).
   */
  constructor(
    startX: number,
    startY: number,
    initialAngle: number = Math.PI / 2,
  ) {
    this.x = startX;
    this.y = startY;
    this.health = 100;
    this.ammo = 30;

    // Start pointing east (1, 0), then rotate to initialAngle.
    [this.dirX, this.dirY] = rotate(1, 0, initialAngle);

    // Camera plane perpendicular to direction.  Starting plane for east-facing
    // direction is (0, 0.66), rotated by the same initialAngle.
    // 0.66 ~= tan(33 deg) which gives a ~66 degree horizontal FOV.
    [this.planeX, this.planeY] = rotate(0, 0.66, initialAngle);
  }

  // -- Public API ------------------------------------------------------------

  /**
   * Update player state for one frame.
   *
   * Reads input from the Input singleton (WASD + mouse delta), rotates the
   * view direction, and moves the player through the world with AABB sliding
   * collision resolution.
   *
   * @param dt    Elapsed seconds since last frame (e.g. ~0.0167 at 60 fps).
   * @param world The current level's WorldData used for collision queries.
   */
  update(dt: number, world: WorldData): void {
    this._handleMouseLook();
    this._handleMovement(dt, world);
  }

  // -- Private helpers -------------------------------------------------------

  /**
   * Rotate the view direction and camera plane based on the accumulated mouse
   * horizontal delta.
   */
  private _handleMouseLook(): void {
    const { dx } = Input.instance.consumeMouseDelta();
    if (dx === 0) return;

    // Positive dx = mouse moved right = clockwise rotation in screen space.
    // Our rotate() is counter-clockwise in math coords, and with +y pointing
    // down that means clockwise on screen -- so we negate dx to get the
    // "turn right when moving right" feel.
    const angle = -dx * LOOK_SENSITIVITY;
    [this.dirX, this.dirY] = rotate(this.dirX, this.dirY, angle);
    [this.planeX, this.planeY] = rotate(this.planeX, this.planeY, angle);
  }

  /**
   * Poll WASD (plus arrow keys) and compute a world-space displacement,
   * then resolve it with slide-move collision.
   */
  private _handleMovement(dt: number, world: WorldData): void {
    const input = Input.instance;

    let fwd = 0;    // +1 = forward (into screen), -1 = backward
    let side = 0;   // +1 = strafe right, -1 = strafe left

    if (input.isDown("KeyW") || input.isDown("ArrowUp"))    fwd  += 1;
    if (input.isDown("KeyS") || input.isDown("ArrowDown"))  fwd  -= 1;
    if (input.isDown("KeyD") || input.isDown("ArrowRight")) side += 1;
    if (input.isDown("KeyA") || input.isDown("ArrowLeft"))  side -= 1;

    if (fwd === 0 && side === 0) return;

    // Forward direction vector: (dirX, dirY).
    // Right-strafe direction: perpendicular to forward.
    // With +y pointing down the right-perpendicular of (dx, dy) is (dy, -dx).
    const stepX =
      this.dirX * (fwd  * MOVE_SPEED   * dt) +
      this.dirY * (side * STRAFE_SPEED * dt);

    const stepY =
      this.dirY * (fwd  * MOVE_SPEED   * dt) +
      (-this.dirX) * (side * STRAFE_SPEED * dt);

    [this.x, this.y] = slideMove(this.x, this.y, stepX, stepY, world);
  }
}
