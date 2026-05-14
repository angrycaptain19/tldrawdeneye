/**
 * World
 *
 * A 24×24 `Uint8Array` grid that represents the top-down level layout used by
 * the raycaster, minimap renderer, collision system, and enemy spawner.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Cell-type legend
 * ─────────────────────────────────────────────────────────────────────────────
 *  0  EMPTY         – open floor; player / enemies may pass through
 *  1  WALL          – solid wall block; used for all wall variants
 *  2  DOOR          – door tile (initially closed); managed by DoorSystem
 *  3  PICKUP_SPAWN  – floor cell that spawns a collectible (ammo, health, key)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Level design: "Facility – Surface Station"
 *
 * Inspired by GoldenEye 007 (N64).  The 24×24 map contains:
 *
 *   • An outer perimeter wall (rows 0-1, 22-23 and implied by side walls)
 *   • A central atrium         – rows 10-14, cols 3-20  (open courtyard)
 *   • North corridor           – rows 5-9,  cols 7-16   (objective approach)
 *   • Mission-objective room   – rows 2-8,  cols 7-16   (top-centre, 2 doors)
 *   • South corridor / armory  – rows 15-22, cols 7-16  (ammo & utility room)
 *   • NW guard room            – rows 2-8,  cols 2-6
 *   • NE guard room            – rows 2-8,  cols 17-22
 *   • SW guard room            – rows 15-22, cols 2-6
 *   • SE guard room            – rows 15-22, cols 17-22
 *   • 12 doors on room thresholds (DoorSystem animates these)
 *   • 14 pickup spawns at tactically interesting floor positions
 *
 * Map legend (source string characters):
 *   '#'  → CellType.WALL         (1)
 *   'D'  → CellType.DOOR         (2)
 *   'P'  → CellType.PICKUP_SPAWN (3)
 *   '.'  → CellType.EMPTY        (0)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of cells along each axis. */
export const WORLD_SIZE = 24 as const;

// ---------------------------------------------------------------------------
// Cell-type enum
// ---------------------------------------------------------------------------

export const enum CellType {
  EMPTY        = 0,
  WALL         = 1,
  DOOR         = 2,
  PICKUP_SPAWN = 3,
}

// ---------------------------------------------------------------------------
// String-literal level map  (24 rows × 24 columns)
// ---------------------------------------------------------------------------
//
//   Row  0-1   top perimeter wall
//   Row  2-8   NW guard room | mission-objective room | NE guard room
//   Row  9-10  corridor + atrium north wall
//   Row 11-13  central atrium (open courtyard with side corridors)
//   Row 14-15  atrium south wall + corridor
//   Row 16-22  SW guard room | armory / utility room | SE guard room
//   Row 23     bottom perimeter wall
//
const LEVEL_MAP_ROWS: readonly string[] = [
  '########################', // row  0 – top perimeter
  '########################', // row  1 – top perimeter
  '##....##########....####', // row  2 – NW/NE room tops; N-corridor approach
  '##.P..#....D....#.P..###', // row  3 – guard rooms; door into objective room
  '##....#..........#...###', // row  4 – guard rooms interior; obj. room
  '###D###....P.....###D###', // row  5 – guard-room doors to N-corridor
  '###...#..........#...###', // row  6 – N-corridor; objective room interior
  '###...###.....####...###', // row  7 – objective room narrows
  '###...##########.....###', // row  8 – objective room south wall
  '###.P..D....D...D.P..###', // row  9 – atrium N doors; side-room pickups
  '###....##########....###', // row 10 – atrium north wall
  '###.P.............P..###', // row 11 – atrium W corridor; open; E corridor
  '###..................###', // row 12 – atrium centre (fully open)
  '###.P.............P..###', // row 13 – atrium W corridor; open; E corridor
  '###....##########....###', // row 14 – atrium south wall
  '###.P..D....D...D.P..###', // row 15 – atrium S doors; side-room pickups
  '###...##########.....###', // row 16 – armory north wall
  '###...###.....####...###', // row 17 – armory room narrows
  '###...#..........#...###', // row 18 – armory room interior
  '###D###....P.....###D###', // row 19 – guard-room doors to S-corridor
  '##....#..........#...###', // row 20 – guard rooms interior; armory
  '##.P..#....D....#.P..###', // row 21 – guard rooms; door into armory
  '##....##########....####', // row 22 – SW/SE room bases
  '########################', // row 23 – bottom perimeter
];

// ---------------------------------------------------------------------------
// Parse helper
// ---------------------------------------------------------------------------

function charToCell(ch: string): CellType {
  switch (ch) {
    case '#': return CellType.WALL;
    case 'D': return CellType.DOOR;
    case 'P': return CellType.PICKUP_SPAWN;
    default:  return CellType.EMPTY;
  }
}

// ---------------------------------------------------------------------------
// WorldData type
// ---------------------------------------------------------------------------

/** The complete grid state for one level. */
export interface WorldData {
  /** Flat, row-major `Uint8Array` of length `size * size`. */
  cells: Uint8Array;
  /** Width and height of the square grid (always `WORLD_SIZE`). */
  size: number;
}

// ---------------------------------------------------------------------------
// Level loader
// ---------------------------------------------------------------------------

/**
 * Parse a string-array map into a `WorldData` object.
 *
 * Validates that the source has exactly `WORLD_SIZE` rows and each row is
 * exactly `WORLD_SIZE` characters wide.  Throws a descriptive `Error` at
 * module-load time if the map is malformed (fail-fast during development).
 */
function loadLevel(rows: readonly string[]): WorldData {
  if (rows.length !== WORLD_SIZE) {
    throw new Error(
      `World map must have exactly ${WORLD_SIZE} rows, got ${rows.length}.`,
    );
  }

  const cells = new Uint8Array(WORLD_SIZE * WORLD_SIZE);

  for (let y = 0; y < WORLD_SIZE; y++) {
    const row = rows[y]!;
    if (row.length !== WORLD_SIZE) {
      throw new Error(
        `World map row ${y} must be exactly ${WORLD_SIZE} chars wide, ` +
          `got ${row.length}: "${row}"`,
      );
    }
    for (let x = 0; x < WORLD_SIZE; x++) {
      cells[y * WORLD_SIZE + x] = charToCell(row[x]!);
    }
  }

  return { cells, size: WORLD_SIZE };
}

// ---------------------------------------------------------------------------
// Exported level instance
// ---------------------------------------------------------------------------

/**
 * Level 1 — "Facility – Surface Station".
 *
 * Parsed once at module-load time from the embedded string-literal map.
 * All engine systems (Raycaster, Player collision, EnemySystem, DoorSystem,
 * MinimapShape) operate on this shared `WorldData` object.
 */
export const LEVEL_1: WorldData = loadLevel(LEVEL_MAP_ROWS);

// ---------------------------------------------------------------------------
// Typed helper: getCell
// ---------------------------------------------------------------------------

/**
 * Returns the `CellType` at grid position `(x, y)`.
 *
 * @param world - The `WorldData` to query.
 * @param x     - Column index (0 … WORLD_SIZE-1), left → right.
 * @param y     - Row index    (0 … WORLD_SIZE-1), top  → bottom.
 * @returns `CellType.WALL` for any out-of-bounds coordinate (treat as solid).
 *
 * @example
 * ```ts
 * const cell = getCell(LEVEL_1, 12, 12); // centre of the atrium → EMPTY
 * ```
 */
export function getCell(world: WorldData, x: number, y: number): CellType {
  if (x < 0 || x >= world.size || y < 0 || y >= world.size) {
    // Out-of-bounds → solid boundary so callers never need an explicit check.
    return CellType.WALL;
  }
  return world.cells[y * world.size + x] as CellType;
}

// ---------------------------------------------------------------------------
// Typed helper: setCell
// ---------------------------------------------------------------------------

/**
 * Mutates the `CellType` at grid position `(x, y)` in-place.
 *
 * Primary consumers:
 *   - `DoorSystem` — toggles `DOOR` ↔ `EMPTY` as doors animate open/closed.
 *   - Level editor — lets a designer repaint cells via tldraw drawing tools.
 *
 * @param world - The `WorldData` to mutate.
 * @param x     - Column index (0 … WORLD_SIZE-1).
 * @param y     - Row index    (0 … WORLD_SIZE-1).
 * @param type  - The new `CellType` to write.
 * @throws `RangeError` if `(x, y)` is out of bounds.
 *
 * @example
 * ```ts
 * // DoorSystem opens a door:
 * setCell(LEVEL_1, doorX, doorY, CellType.EMPTY);
 * ```
 */
export function setCell(
  world: WorldData,
  x: number,
  y: number,
  type: CellType,
): void {
  if (x < 0 || x >= world.size || y < 0 || y >= world.size) {
    throw new RangeError(
      `setCell: position (${x}, ${y}) is out of bounds for a ` +
        `${world.size}×${world.size} grid.`,
    );
  }
  world.cells[y * world.size + x] = type;
}

// ---------------------------------------------------------------------------
// Typed helper: isSolid
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the cell at `(x, y)` blocks ray travel and player / enemy
 * movement.
 *
 * Collision rules:
 *   - `WALL`         → **solid** (always blocks)
 *   - `DOOR`         → **solid** (closed door blocks; `DoorSystem` opens it by
 *                       replacing the tile with `EMPTY` during animation)
 *   - `EMPTY`        → passable
 *   - `PICKUP_SPAWN` → passable (player walks over it to collect the item)
 *   - out-of-bounds  → treated as solid (via `getCell` boundary behaviour)
 *
 * @param world - The `WorldData` to query.
 * @param x     - Column index.
 * @param y     - Row index.
 * @returns `true` for `WALL` and `DOOR`; `false` for `EMPTY` and `PICKUP_SPAWN`.
 *
 * @example
 * ```ts
 * if (isSolid(LEVEL_1, nextX, nextY)) {
 *   // block player movement
 * }
 * ```
 */
export function isSolid(world: WorldData, x: number, y: number): boolean {
  const cell = getCell(world, x, y);
  return cell === CellType.WALL || cell === CellType.DOOR;
}
