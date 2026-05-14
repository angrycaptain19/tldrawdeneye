# Audio Assets

Place audio files here as `.ogg` or `.mp3` format. The `AudioManager` tries each
extension in that order and falls back to synthesised sounds when no file is found.

## Expected filenames

| Sound event         | Filename (no ext)      |
|---------------------|------------------------|
| PP7 gunshot         | `gunshot_pp7`          |
| KF7 burst           | `gunshot_kf7`          |
| Explosion           | `explosion`            |
| Enemy death         | `enemy_death`          |
| Enemy alert         | `enemy_alert`          |
| Door open           | `door_open`            |
| Door close          | `door_close`           |
| Footstep (carpet)   | `footstep_left` / `footstep_right` |
| Footstep (stone)    | `footstep_stone_left` / `footstep_stone_right` |
| Player hurt         | `player_hurt`          |
| Pickup chime        | `pickup`               |
| Reload              | `reload`               |
| Empty-gun click     | `empty_click`          |
| Ambient music       | `music_ambient`        |

All synthesiser fallbacks are included in `AudioManager.ts` — no files are required
to run the game.
