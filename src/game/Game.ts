import { Camera } from '../engine/Camera.ts';
import { Input } from '../engine/Input.ts';
import { Raycaster } from '../engine/Raycaster.ts';
import { audioManager } from '../audio/AudioManager.ts';
import { Player } from './Player.ts';
import { EnemySystem } from './EnemySystem.ts';
import { DoorSystem } from './DoorSystem.ts';
import { SpriteRenderer } from './SpriteRenderer.ts';
import { buildMap, collectDoors, createEnemies, createPickups } from './World.ts';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private camera: Camera;
  private input: Input;
  private raycaster: Raycaster;
  private spriteRenderer: SpriteRenderer;
  private player: Player;
  private enemySystem: EnemySystem;
  private doorSystem: DoorSystem;

  private map = buildMap();
  private doors = collectDoors(this.map);
  private enemies = createEnemies();
  private pickups = createPickups();

  private _running = false;
  private _paused = false;
  private _lastTime = 0;

  private lockOverlay: HTMLElement;
  private audioStatus: HTMLElement;
  private healthFill: HTMLElement;
  private healthVal: HTMLElement;
  private ammoCur: HTMLElement;
  private ammoTotal: HTMLElement;
  private hitFlash: HTMLElement;
  private alertMsg: HTMLElement;
  private _alertMsgTimer = 0;
  private _hitFlashTimer = 0;
  private _prevMKey = false;
  private _prevBracketUp = false;
  private _prevBracketDown = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context required');
    this.ctx2d = ctx;
    this.camera = new Camera();
    this.input = new Input();
    this.raycaster = new Raycaster(canvas);
    this.spriteRenderer = new SpriteRenderer();
    this.player = new Player(this.camera);
    this.enemySystem = new EnemySystem();
    this.doorSystem = new DoorSystem();

    this.lockOverlay = document.getElementById('lock-overlay')!;
    this.audioStatus = document.getElementById('audio-status')!;
    this.healthFill = document.getElementById('health-fill')!;
    this.healthVal = document.getElementById('health-val')!;
    this.ammoCur = document.getElementById('ammo-cur')!;
    this.ammoTotal = document.getElementById('ammo-total')!;
    this.hitFlash = document.getElementById('hit-flash')!;
    this.alertMsg = document.getElementById('alert-msg')!;
  }

  init(): void {
    this.input.init();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.lockOverlay.addEventListener('click', () => void this._requestPointerLock());
    document.addEventListener('pointerlockchange', () => this._onPLChange());
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this._running && !this._paused) this._pause();
    });
  }

  private _resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.raycaster.resize();
  }

  private async _requestPointerLock(): Promise<void> {
    if (!audioManager.ready) {
      await audioManager.init();
      this._updateAudioStatus();
      if (audioManager.ready) audioManager.startMusic();
    }
    await this.canvas.requestPointerLock();
  }

  private _onPLChange(): void {
    if (document.pointerLockElement === this.canvas) {
      this.lockOverlay.style.display = 'none';
      if (!this._running) {
        this._running = true;
        this._lastTime = performance.now();
        this._loop();
      }
      this._paused = false;
      audioManager.resume();
    } else { this._pause(); }
  }

  private _pause(): void {
    this._paused = true;
    this.lockOverlay.style.display = 'flex';
    audioManager.suspend();
  }

  private _loop(): void {
    requestAnimationFrame((ts) => {
      if (!this._paused) {
        const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
        this._lastTime = ts;
        this._update(dt);
        this._render();
      }
      this._loop();
    });
  }

  private _update(dt: number): void {
    const mDown = this.input.keys.has('KeyM');
    if (mDown && !this._prevMKey) audioManager.toggleMusic();
    this._prevMKey = mDown;

    const volUp = this.input.keys.has('BracketRight');
    const volDown = this.input.keys.has('BracketLeft');
    if (volUp && !this._prevBracketUp) audioManager.musicVolume = audioManager.musicVolume + 0.05;
    if (volDown && !this._prevBracketDown) audioManager.musicVolume = audioManager.musicVolume - 0.05;
    this._prevBracketUp = volUp;
    this._prevBracketDown = volDown;

    this.player.update(dt, this.input, this.map, this.doors, this.enemies, this.pickups, (hitEnemy) => {
      if (hitEnemy) this.enemySystem.hitEnemy(hitEnemy, 34);
    });

    this.doorSystem.update(dt, this.doors, this.map);
    this.enemySystem.update(dt, this.enemies, this.camera, this.map, (enemy) => {
      const dx = enemy.x - this.camera.x; const dz = enemy.z - this.camera.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 8) {
        this.player.takeDamage(Math.round(8 + Math.random() * 12));
        this._triggerHitFlash();
      }
    });

    if (this._hitFlashTimer > 0) {
      this._hitFlashTimer -= dt;
      if (this._hitFlashTimer <= 0) this.hitFlash.style.background = 'rgba(255,0,0,0)';
    }
    if (this._alertMsgTimer > 0) {
      this._alertMsgTimer -= dt;
      if (this._alertMsgTimer <= 0) this.alertMsg.style.opacity = '0';
    }
    for (const e of this.enemies) {
      if ((e.state === 'alert' || e.state === 'chase') && e.alertTimer < 0.1) this._showAlertMsg();
    }
    this._updateHUD();
    this._updateAudioStatus();
  }

  private _render(): void {
    this.raycaster.render(this.camera, this.map);
    this.spriteRenderer.render(this.ctx2d, this.camera, this.enemies, this.pickups, this.raycaster.getZBuffer());
  }

  private _updateHUD(): void {
    const p = this.player;
    const pct = (p.health / p.maxHealth) * 100;
    this.healthFill.style.width = `${pct}%`;
    this.healthFill.style.background = pct > 60 ? '#4caf50' : pct > 30 ? '#ff9800' : '#f44336';
    this.healthVal.textContent = String(p.health);
    this.ammoCur.textContent = String(p.ammo);
    this.ammoTotal.textContent = String(p.totalAmmo);
  }

  private _updateAudioStatus(): void {
    if (!audioManager.ready) { this.audioStatus.textContent = '♪ NO AUDIO'; return; }
    this.audioStatus.textContent = audioManager.musicEnabled
      ? `♪ ON  VOL ${Math.round(audioManager.musicVolume * 100)}%`
      : '♪ OFF';
  }

  private _triggerHitFlash(): void {
    this.hitFlash.style.background = 'rgba(255,0,0,0.30)';
    this._hitFlashTimer = 0.2;
  }

  private _showAlertMsg(): void {
    this.alertMsg.style.opacity = '1';
    this._alertMsgTimer = 2.5;
  }
}
