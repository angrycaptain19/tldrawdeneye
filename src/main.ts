/**
 * Entry point — creates the Game instance and starts it.
 */
import { Game } from './game/Game.ts';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('No canvas element found');

const game = new Game(canvas);
game.init();
