/**
 * Input
 *
 * Singleton that handles all keyboard and pointer-lock mouse input for the
 * game engine.
 *
 * - Tracks a Set<string> of currently-held KeyboardEvent.code values so any
 *   subsystem can call `isDown("KeyW")` without coordinating state.
 * - Accumulates raw Pointer Lock mouse-movement deltas each frame; callers
 *   retrieve and atomically reset them with `consumeMouseDelta()`.
 * - Requests Pointer Lock on a provided HTMLElement and falls back silently
 *   when the API is unavailable (e.g. jsdom, iframe without allow attribute).
 * - `destroy()` removes every event listener added during construction so the
 *   instance can be torn down cleanly (React StrictMode, HMR, etc.).
 */
export class Input {
  // ── Singleton ──────────────────────────────────────────────────────────────
  private static _instance: Input | undefined;

  /** Always returns the shared Input singleton, creating it on first access. */
  static get instance(): Input {
    if (!Input._instance) {
      Input._instance = new Input();
    }
    return Input._instance;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  /** Set of KeyboardEvent.code strings that are currently pressed. */
  private readonly _keys = new Set<string>();

  /** Accumulated Pointer Lock mouse delta since the last consumeMouseDelta(). */
  private _dx = 0;
  private _dy = 0;

  // ── Bound handlers (kept so removeEventListener works correctly) ───────────
  private readonly _onKeyDown: (e: KeyboardEvent) => void;
  private readonly _onKeyUp: (e: KeyboardEvent) => void;
  private readonly _onMouseMove: (e: MouseEvent) => void;

  // ── Constructor ────────────────────────────────────────────────────────────
  private constructor() {
    this._onKeyDown = (e: KeyboardEvent) => {
      this._keys.add(e.code);
    };

    this._onKeyUp = (e: KeyboardEvent) => {
      this._keys.delete(e.code);
    };

    this._onMouseMove = (e: MouseEvent) => {
      this._dx += e.movementX;
      this._dy += e.movementY;
    };

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    // mousemove is listened on document so Pointer Lock events fire regardless
    // of which element currently holds the lock.
    document.addEventListener("mousemove", this._onMouseMove);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns `true` while the key identified by the given
   * [KeyboardEvent.code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code)
   * string is held down (e.g. "KeyW", "Space", "ArrowLeft").
   */
  isDown(code: string): boolean {
    return this._keys.has(code);
  }

  /**
   * Returns the accumulated Pointer Lock mouse delta since the last call and
   * resets the internal counters to zero.  Call once per frame (or per
   * tick) to get per-frame mouse movement.
   */
  consumeMouseDelta(): { dx: number; dy: number } {
    const result = { dx: this._dx, dy: this._dy };
    this._dx = 0;
    this._dy = 0;
    return result;
  }

  /**
   * Requests Pointer Lock on `element`.  If the Pointer Lock API is
   * unavailable (older browsers, jsdom, cross-origin iframes without the
   * `allow="pointer-lock"` attribute) the error is caught and ignored so
   * the game still runs without mouse-look.
   */
  requestPointerLock(element: HTMLElement): void {
    if (typeof element.requestPointerLock !== "function") {
      // Graceful fallback: API not supported.
      return;
    }
    try {
      // requestPointerLock() returns a Promise in newer browsers but is void
      // in older ones.  We cast to unknown and handle both shapes.
      const result = element.requestPointerLock() as unknown;
      if (result instanceof Promise) {
        result.catch(() => {
          // Pointer Lock was refused (e.g. not in a user-gesture, or inside a
          // sandboxed iframe).  The game continues without it.
        });
      }
    } catch {
      // Synchronous throw path (old browsers / test environments).
    }
  }

  /**
   * Removes all event listeners registered by this instance.  After calling
   * `destroy()` the singleton reference is also cleared so a fresh instance
   * can be created later if needed.
   */
  destroy(): void {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    document.removeEventListener("mousemove", this._onMouseMove);

    this._keys.clear();
    this._dx = 0;
    this._dy = 0;

    // Clear the singleton so callers can create a fresh instance after HMR /
    // component teardown.
    if (Input._instance === this) {
      Input._instance = undefined;
    }
  }
}
