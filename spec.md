# BGMI Style Battle Royale Game

## Current State
Project currently has a Car Racing Game. We are replacing it with a new top-down 2D battle royale shooter game.

## Requested Changes (Diff)

### Add
- Top-down 2D battle royale game using Canvas API
- Player character controlled with WASD / arrow keys
- Mouse aim and click to shoot
- Shrinking safe zone (blue zone) mechanic like BGMI
- Multiple AI enemy bots that patrol and attack player
- Weapon pickups on map (guns with ammo)
- Health bar and armor system
- Kill counter and score display
- Game over screen with stats (kills, survival time)
- Leaderboard saving top scores to backend
- Mobile touch controls (joystick + shoot button)
- Minimap showing player position and safe zone

### Modify
- Replace Car Racing Game entirely with new battle royale game
- Update project name to "Battle Zone"

### Remove
- All car racing game logic and assets

## Implementation Plan
1. Backend: Store leaderboard entries (player name, kills, survival time, score)
2. Frontend: Canvas-based top-down game
   - Game map with obstacles (walls, trees, rocks)
   - Player movement (WASD + mouse aim)
   - Shooting mechanic (bullets, collision detection)
   - AI enemies with basic pathfinding and attack behavior
   - Shrinking safe zone that deals damage outside it
   - Weapon/ammo pickups scattered on map
   - HUD: health bar, ammo count, kill counter, zone timer, minimap
   - Game over screen with leaderboard submission
   - Touch controls for mobile
