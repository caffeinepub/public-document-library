# Car Racing Game

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- 2D car racing game using Canvas API
- Player controls their car using arrow keys or WASD
- Multiple AI opponent cars on a scrolling road
- Score/distance tracking as the game progresses
- Speed increases over time for difficulty progression
- Lives/health system (3 lives)
- Game over screen with final score and restart option
- Leaderboard to save high scores on the backend
- Start screen with game title and instructions
- Road with lane markings that scroll downward to simulate movement
- Player car can move left/right to avoid obstacles and opponents
- Sound effects via Web Audio API (optional)

### Modify
- Nothing (new project)

### Remove
- Nothing (new project)

## Implementation Plan
1. Backend: Store high scores with player name and score
2. Frontend: Canvas-based 2D racing game
   - Scrolling road with lane markings
   - Player car (keyboard controlled: arrow keys / WASD)
   - AI opponent cars coming from top
   - Collision detection
   - Score display (distance traveled)
   - Speed progression
   - 3 lives system
   - Game states: start, playing, game over
   - High score submission and leaderboard display
