# Pickleball Game — Specification

## Overview

A browser-based 2D pickleball game rendered on an HTML5 Canvas. The game is presented in side-view (elevation view), showing the ball's height, the net, and realistic bouncing physics. A human player on the left competes against a CPU-controlled AI opponent on the right. The game faithfully follows official pickleball rules including the two-bounce rule, kitchen/NVZ restrictions, and traditional (rally-independent) scoring.

---

## Court Layout

Canvas dimensions: **960 × 540 px**, landscape orientation.

| Element | Value (px) |
|---|---|
| Canvas width | 960 |
| Canvas height | 540 |
| Ground Y (court surface) | 490 |
| Court left sideline | 50 |
| Court right sideline | 910 |
| Net X (center) | 480 |
| Net top Y | 420 (height = 70 px) |
| Kitchen left line | 340 |
| Kitchen right line | 620 |
| Score header height | 50 |

The net divides the court in half. The kitchen (Non-Volley Zone) extends 140 px from the net on each side. The player occupies the left half (x = 50–480) and the AI occupies the right half (x = 480–910).

---

## Game Rules

### 1. Two-Bounce Rule
After the serve, play proceeds through three states:

- **RECEIVER_MUST_BOUNCE** — immediately after the serve; the receiving side must let the ball bounce before returning (no volleying allowed for the receiver).
- **SERVER_MUST_BOUNCE** — after the receiver's return; the serving side must now let the ball bounce once before volleying.
- **FREE** — after both required bounces have occurred; either player may volley freely (subject to kitchen rules).

### 2. Kitchen / Non-Volley Zone (NVZ) Rule
A player may not volley (hit the ball while it is in the air, without a bounce) while standing inside the kitchen zone:
- Player kitchen: x = 340–480
- AI kitchen: x = 480–620

Stepping into the kitchen to hit a bounced ball is allowed.

### 3. Serve Must Land in Service Box
The serve must clear the net and land **between the kitchen line and the baseline** on the opponent's side. Landing in the opponent's kitchen is a fault.

### 4. Net Fault
If the ball crosses the net (passes NET_X) while its center is below NET_TOP_Y (y > 420), the hitter commits a fault.

### 5. Out of Bounds
If the ball travels past COURT_LEFT (x < 50) or COURT_RIGHT (x > 910) without bouncing in, the last hitter commits a fault.

### 6. Scoring
Pickleball uses traditional (side-out) scoring:
- Only the **serving side** can score a point.
- If the serving side wins the rally, they score +1.
- If the receiving side wins the rally, a **sideout** occurs: service passes to the other side without a point change.
- First to **11 points**, winning by at least **2**, wins the game.

---

## Controls

| Key | Action |
|---|---|
| A | Move player left |
| D | Move player right |
| Space | Serve (when it is the player's turn to serve) |

The player is confined to the left half of the court (x = 50–480).

---

## Scoring System

- `scores[0]` — human player score
- `scores[1]` — AI score
- `server` — 0 (player) or 1 (AI); tracks who is currently serving
- Game ends when `Math.max(...scores) >= 11` and `|scores[0] - scores[1]| >= 2`

After each rally ends, a 2-second result message is displayed before play resumes.

---

## Game States

| State | Description |
|---|---|
| `MENU` | Title screen; shows controls and "Press Space to Start" |
| `SERVING` | Server holds ball; player presses Space to serve; AI auto-serves after 1.5 s |
| `PLAYING` | Live rally in progress |
| `GAME_OVER` | Winner banner shown; Space restarts |

### Serve Positions
Serve side is determined by the server's score (even = right side, odd = left side):
- Player serves from x ≈ 350 (right/even) or x ≈ 150 (left/odd)
- AI serves from x ≈ 610 (left/even) or x ≈ 820 (right/odd)

Ball is held at GROUND_Y − BALL_RADIUS until launched.

---

## Technical Architecture

```
index.html          — canvas element, loads scripts
style.css           — page background and canvas centering
js/constants.js     — all magic numbers (dimensions, physics, colors)
js/ball.js          — Ball class: physics update, bounce, draw
js/player.js        — Player class: movement, paddle draw, hit detection
js/game.js          — Game class: state machine, loop, scoring, AI
```

Script load order: constants.js → ball.js → player.js → game.js

The game loop uses `requestAnimationFrame`. Delta time is capped at 50 ms per frame to prevent physics explosions after tab switches or long pauses.

### Ball Physics
- Gravity: 900 px/s² (applied every frame)
- Ground bounce: `vy *= -RESTITUTION` (0.65); `vx *= FRICTION` (0.95)
- Ball considered at rest on ground when `|vy| < 50` after bounce
- Net collision detected by comparing ball.prevX vs ball.x at each frame

### Hit Detection
- Paddle: 12 × 70 px rectangle, centered at player.x, bottom at GROUND_Y
- Auto-hit triggers when ball overlaps paddle AND ball is moving toward the paddle AND hitCooldown ≤ 0
- After hit: hitCooldown = 0.5 s (prevents double-hit in same pass)
- Launch velocity after hit:
  - `vx = direction × (450 + random ±50)`
  - `vy = -(350 + arcFactor × 250)` where `arcFactor = distFromNet / courtHalfLength`

---

## AI Behavior

- Speed: 320 px/s (slower than player's 380 px/s)
- When ball is moving toward AI (vx > 0): move to intercept ball.x
- Otherwise: drift toward defensive position x = 700
- AI is confined to x = 480–910
- AI auto-serves 1.5 s after entering SERVING state

The AI has slight imperfection built in through random velocity variation on hits (±50 px/s).

---

## Visual Design

| Element | Color |
|---|---|
| Page background | #1a1a2e (dark navy) |
| Court surface | #4a9c6f (teal-green) |
| Kitchen zones | #3d8a60 (darker teal) |
| Court lines | #ffffff |
| Net post | #888888 |
| Net mesh | #dddddd |
| Ball | #f1c40f fill, #d4a017 stroke |
| Player paddle | #3498db (blue) |
| AI paddle | #e74c3c (red) |
| Score header | rgba(0,0,0,0.5) overlay |
| Message overlay | rgba(0,0,0,0.6) with white text |

---

## Future Enhancements

1. **Two-player mode** — second human player controls AI side
2. **Difficulty levels** — adjustable AI speed and reaction accuracy
3. **Sound effects** — paddle hit, bounce, point scored
4. **Animated crowd / background** — stadium atmosphere
5. **Mobile touch controls** — on-screen buttons for phone/tablet play
6. **Spin mechanics** — topspin/backspin affecting bounce angle
7. **Lob and dink shots** — distinct shot types via key combinations
8. **Online multiplayer** — WebSocket-based real-time play
9. **Full doubles mode** — four players (two per side)
10. **Tournament bracket** — multi-game match progression
