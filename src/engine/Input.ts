export class Input {
  readonly keys = new Set<string>();
  mouseDeltaX = 0;
  mouseDeltaY = 0;
  mouseButtonsDown = new Set<number>();
  mouseButtonsJustPressed = new Set<number>();
  private _locked = false;

  get pointerLocked(): boolean { return this._locked; }

  private _onKeyDown = (e: KeyboardEvent) => { this.keys.add(e.code); };
  private _onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private _onMouseMove = (e: MouseEvent) => {
    if (this._locked) { this.mouseDeltaX += e.movementX; this.mouseDeltaY += e.movementY; }
  };
  private _onMouseDown = (e: MouseEvent) => {
    this.mouseButtonsDown.add(e.button); this.mouseButtonsJustPressed.add(e.button);
  };
  private _onMouseUp = (e: MouseEvent) => { this.mouseButtonsDown.delete(e.button); };
  private _onPLChange = () => { this._locked = document.pointerLockElement !== null; };

  init(): void {
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onPLChange);
  }

  flush(): void {
    this.mouseDeltaX = 0; this.mouseDeltaY = 0;
    this.mouseButtonsJustPressed.clear();
  }

  destroy(): void {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onPLChange);
  }
}
