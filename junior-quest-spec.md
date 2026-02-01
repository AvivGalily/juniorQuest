# Junior Quest: The Job Hunt (Web 2D 16-bit) — SPEC FOR CODEX

> Goal: Build a complete single-player web game (client-only) with 5 stages, retro 16-bit vibe, and a local leaderboard.  
> Target: One deployable static site (Vite build) running smoothly in modern browsers.

---

## 0) Tech Stack (MANDATORY)
- Engine: Phaser 3 (latest stable)
- Language: TypeScript
- Build Tool: Vite
- Rendering: Pixel-art friendly, internal low-res canvas scaled up to 1920×1080
- Physics: Phaser Arcade Physics
- Save: LocalStorage (for settings + local leaderboard)
- Audio: WebAudio via Phaser

---

## 1) High-Level Game Concept
You play a **junior developer** trying to get a job in hi-tech. Progress through 5 levels that satirize typical “junior challenges”.  
If you lose all hearts in a level: **Game Over → return to Start Screen** while keeping the score you accumulated in this run.

Visual style: early 2000s 16-bit 2D pixel art.

---

## 2) Resolution + Pixel Scaling (IMPORTANT)
### Display
- Actual browser canvas: **1920×1080** (16:9)

### Internal “pixel” resolution
- Use internal base: **480×270** (16:9) or **640×360** (16:9)
- Scale up with nearest-neighbor (pixelPerfect) for crisp 16-bit visuals.

### Phaser config requirements
- `pixelArt: true`
- `roundPixels: true`
- Scale mode: `Phaser.Scale.FIT`
- Auto center: `CENTER_BOTH`
- Ensure crisp scaling in CSS: `image-rendering: pixelated;` on the canvas.

---

## 3) Controls (MANDATORY)
Support BOTH WASD and arrow keys.

### Global
- Move: **WASD + Arrow Keys**
- Interact / Confirm: **Space OR Left Mouse Click**
- Pause: **Esc**
- Optional: Enter acts like Confirm in menus

### Mouse
- Menus: click buttons
- Level 2 (BST tower): drag-and-drop cubes with mouse
- Level 3/5: mouse for target lock or quick interactions

---

## 4) Game Flow (State Machine)
### Scenes (Phaser)
1. `BootScene` — minimal init
2. `PreloadScene` — load assets (use placeholders if necessary)
3. `MenuScene` — Start screen with buttons
4. `Level1Scene` — Company Fair (Stealth)
5. `Level2Scene` — BST Tower (Drag & Drop + rising water)
6. `Level3Scene` — Linked-List Snake Boss
7. `Level4Scene` — Tower Race
8. `Level5Scene` — AI Spider Boss
9. `GameOverScene` — show run score + “Back to Menu”
10. `VictoryScene` — show final message + local leaderboard entry

### Menu buttons
- **Start Game** (active)
- **About** (disabled / shows “Coming Soon” modal)
- **Leaderboard** (disabled / shows “Coming Soon” modal)

Note: even if disabled, implement a simple modal that says “Coming soon”.

---

## 5) Progression & Hearts
- Each level starts with **3 hearts** (full reset per level).
- Hearts UI: top-left, 3 heart icons (filled/empty).
- On damage:
  - subtract 1 heart
  - play hit SFX
  - brief invulnerability (0.8s blinking) to prevent instant multi-hit
- If hearts reach 0:
  - end run
  - go to `GameOverScene`
  - show final run score (score accumulated until death)

Hearts reset on level transition.

---

## 6) Scoring System (GLOBAL)
Maintain a single `runScore` for the run.

### Components
- Base points per level objective:
  - Level 1 success: **+1000**
  - Level 2 success: **+1500**
  - Level 3 success: **+2000**
  - Level 4 success: **+2500**
  - Level 5 success: **+4000**
- Time bonus:
  - For each level, compute `timeBonus = max(0, levelTimeTargetMs - elapsedMs) * timeFactor`
  - Use a small factor to keep values reasonable.
- Accuracy / mistakes:
  - Level 2: **-100** per invalid placement
  - Level 3: **-50** per combo mistake
  - Level 4: **-100** per fall beyond checkpoint
  - Level 5: **-75** per failed pattern
- Flow Combo multiplier:
  - Start at **x1.0**
  - Successful “skill action” increases combo by 1 step:
    - steps: `0..8`
    - multiplier = `1.0 + steps*0.1` (cap at **1.8**)
  - Mistake or taking damage breaks combo to 0.
  - Apply multiplier ONLY to “skill” events (not the base completion bonus).

### Example skill events
- Level 1: delivering CV without taking damage.
- Level 2: valid placements in a row.
- Level 3: correct node flips in a row.
- Level 4: overtakes / pushes without taking damage.
- Level 5: correct pattern inputs.

Show score and combo top-right:
- Score: integer
- Combo: “FLOW x1.3” etc.

---

## 7) Local Leaderboard (v1)
### Storage
Use LocalStorage key:
- `juniorquest_leaderboard_v1`

### Data format
```json
{
  "entries": [
    {"name":"AAA","score":12345,"dateISO":"2026-02-01T10:00:00.000Z"},
    ...
  ]
}
```

### Rules
- Keep **top 20** scores.
- When player finishes Level 5 (victory):
  - prompt for name input (max 10 chars; allow A–Z, 0–9, and Hebrew characters)
  - store entry
  - show local leaderboard list in `VictoryScene`

Menu “Leaderboard” is “Coming soon” for now, but `VictoryScene` must show local scores.

---

## 8) Difficulty System (Future-proof; implement now as single difficulty)
Define difficulty enum:
- `bootcamp`
- `college`
- `university`

For now always use `bootcamp`, but code must be parameter-driven.

### Difficulty parameters object
Create a config file: `src/config/difficulty.ts` with per-level parameters:
- L1: guard FOV, detection time, guard speed
- L2: water rise rate, penalty jump, cube count, required placements
- L3: snake speed, combo window time, node count
- L4: rivals count, push strength, checkpoint spacing
- L5: boss HP, pattern speed, min reaction window

---

## 9) Common Architecture (MANDATORY)
### Project structure
```
src/
  main.ts
  game/
    phaserConfig.ts
    scenes/
      BootScene.ts
      PreloadScene.ts
      MenuScene.ts
      GameOverScene.ts
      VictoryScene.ts
      Level1Scene.ts
      Level2Scene.ts
      Level3Scene.ts
      Level4Scene.ts
      Level5Scene.ts
    systems/
      InputManager.ts
      AudioManager.ts
      ScoreSystem.ts
      ComboSystem.ts
      SaveSystem.ts
      UIHud.ts
    entities/
      Player.ts
      Guard.ts
      Recruiter.ts
      Rival.ts
      BossAISpider.ts
      SnakeNode.ts
      FloatingText.ts
    utils/
      rng.ts
      math.ts
      tween.ts
      timers.ts
  assets/
    (placeholders)
```

### Global Run State (singleton)
Create `RunState`:
- `currentLevel: 1..5`
- `runScore: number`
- `hearts: number`
- `comboSteps: number`
- `difficulty: Difficulty`
- `levelStartTimeMs: number`
- `mistakes: number` per level
- Provide:
  - `resetRun()`
  - `resetLevel()`

---

# 10) LEVEL 1 — Company Fair (Stealth + Find Correct Recruiter)

## 10.1 Summary
Background: company fair with booths and crowd.  
There are **10 recruiters** wandering. One is randomly selected as the “correct recruiter”.  
Player must deliver a CV to the correct recruiter **without being caught** by a guard.

## 10.2 Map layout
- 2D top-down view (recommended for stealth clarity).
- Map bounds fit internal resolution.
- Include:
  - Entry area
  - 3–5 booths
  - “Notice board” at entrance with the target company tag/logo clue
  - NPC crowd obstacles (static colliders)

## 10.3 Entities
### Player
- Normal walking speed.
- (Optional later) sprint can be added; for v1 ignore or keep simple.

### Recruiters (10)
Each recruiter has:
- id `0..9`
- `companyTag: string`
- idle animation
- waypoint wander AI: walk → pause → walk

### Guard (1)
- Patrol route with waypoints
- Detection cone:
  - Arc/triangle overlay (semi-transparent)
  - If player stays inside cone for > `detectionHoldMs` (e.g. 1000ms) → caught
- On caught:
  - Player loses 1 heart
  - Player respawns at entrance
  - Combo breaks
  - If hearts==0 → Game Over

## 10.4 Selecting target recruiter
- On level start:
  - choose random recruiter id as `targetRecruiterId`
  - set `targetCompanyTag` accordingly
- Notice board shows `targetCompanyTag` clearly.

## 10.5 Delivering CV
- Player starts holding “CV item” (or must pick it up at entrance).
- When close to recruiter and pressing Interact/click:
  - If recruiter == target:
    - show dialog:
      - “Thank you for applying, but you still don’t have enough experience.”
    - Level complete
  - Else:
    - recruiter shows one short rejection line (random):
      - “Send it by email.”
      - “We’re hiring seniors.”
      - “Try the booth next door.”
    - Optional small penalty (time only or -20 score)

## 10.6 Scoring Level 1
- Completion base: +1000
- Time bonus: target **60s**
- Perfect stealth bonus: +300 if no hearts lost
- Each wrong recruiter interaction: -20
- Each guard catch: -200 (in addition to heart loss)

## 10.7 Transition
- Fade out
- Add score
- Reset hearts to 3 for next level
- Go to Level 2

---

# 11) LEVEL 2 — BST Tower (Drag & Drop + Rising Water)

## 11.1 Summary
Player must place numbered cubes on shelves to construct a valid **Binary Search Tree** (BST).  
Water rises continuously. Mistakes accelerate water and can cost hearts.

## 11.2 Visual layout
- Side-view tower interior.
- Bottom: animated water surface.
- Middle: shelves/platforms representing BST node slots.
- Top: indicator when required nodes are placed.

## 11.3 Core rules (BST constraints)
- There is a root slot.
- Additional slots represent BST positions (left/right children across levels).
- Each slot has path constraints derived from ancestors:
  - left < parent
  - right > parent
  - deeper slots have min/max bounds (e.g. >root and <rightChild, etc.)

Represent constraints per slot as:
- `minExclusive?: number`
- `maxExclusive?: number`

## 11.4 Gameplay
- Cubes spawn from a chute.
- Each cube has an integer value (e.g. 1..99).
- Drag and drop:
  - click+hold cube
  - drag to slot
  - release to attempt placement

### Valid placement
- If cube value satisfies constraints and slot empty:
  - snap into slot
  - play SFX
  - increase combo
  - skill score: +80 * multiplier

### Invalid placement
- Cube shakes then falls into water and disappears
- `mistakes++`
- combo resets
- score penalty -100
- water jumps upward by `waterPenaltyJumpPx`
- if water reaches danger threshold → lose heart

## 11.5 Water system
- Water rises at constant rate (px/sec).
- Water also jumps on mistakes.
- If water reaches “danger line”:
  - lose 1 heart
  - water drops down by a chunk (so play can continue)
  - optional: remove one random unplaced cube from queue

If hearts == 0 → Game Over.

## 11.6 Win condition
- Place `requiredPlacements` cubes (e.g. 11) into valid slots.
- On completion:
  - stop water
  - award completion bonus +1500
  - time bonus target **90s**
  - go to Level 3

## 11.7 Scoring Level 2
- Valid placement: +80 * multiplier
- Invalid placement: -100
- Completion: +1500
- No-heart-loss bonus: +400
- Time bonus: target 90s

---

# 12) LEVEL 3 — Reverse Linked List Snake (Boss Fight)

## 12.1 Summary
A snake boss is a linked list. To defeat it, you must reverse the list by flipping node pointers through short action combos while dodging attacks.

## 12.2 Arena
- Side-view arena with ground.
- Snake occupies center; nodes visible as segments.

## 12.3 Snake representation
- Node count: `nodesCount` from difficulty (e.g. 7 in bootcamp)
- Each node has:
  - value label
  - arrow indicator showing current next direction
- Victory when all nodes are flipped and final “head/tail swap” confirmation triggers.

## 12.4 Flip-a-node loop (short combo)
For each node:
1) Target node:
   - Move near node and left click OR press Space in range to lock target
2) Execute combo within window (e.g. 2.0s):
   - Q = set next to previous
   - E = set prev to next (visual cue)
   - ArrowLeft/ArrowRight also accepted
   - Shift = Commit
3) Correct sequence:
   - arrow flips
   - node flashes
   - comboSteps++
   - skill score +120 * multiplier
4) Wrong order or timeout:
   - snake attacks immediately
   - player loses 1 heart
   - combo resets
   - node remains unflipped

## 12.5 Dodging
Snake attacks periodically:
- Bite dash: telegraphed then dashes.
Player dodges via:
- Jump (Space) OR roll (Down + Space)

If hit:
- lose 1 heart
- brief invulnerability

## 12.6 Win condition
- All nodes flipped → snake collapses and rotates 180° (fun animation)
- Completion bonus +2000
- Go to Level 4

## 12.7 Scoring Level 3
- Successful node flip: +120 * multiplier
- Failed combo: -50
- Completion: +2000
- Time bonus target **120s**
- No-heart-loss bonus: +500

---

# 13) LEVEL 4 — Tower Race (Platform + Push Rivals)

## 13.1 Summary
Vertical tower race vs rivals. Reach the top first. Rivals can push you down; you can push them.

## 13.2 Mechanics
- Side-view vertical scrolling platformer.
- Platforms + ladders or jump pads.
- Rivals have simple upward-chasing AI.

### Push
- Near a rival: Space to push
- Applies knockback
- Rivals can push player similarly

### Checkpoints
- Checkpoint every X vertical distance.
- If player falls below camera by Y:
  - respawn at last checkpoint
  - lose 1 heart
  - score -100
If hearts==0 → Game Over.

## 13.3 Win condition
- Reach top door first.
- Completion bonus +2500
- Go to Level 5

## 13.4 Scoring Level 4
- Overtake event: +100 * multiplier
- Fall respawn penalty: -100
- Completion: +2500
- Time bonus target **150s**
- No-heart-loss bonus: +600

---

# 14) LEVEL 5 — AI Spider Boss (Final)

## 14.1 Summary
Recruiter says the job is no longer needed because AI. You fight an AI spider computer boss. Defeat it to finish the game.

## 14.2 Intro dialog
Show recruiter sprite + text:
- “You were the best in interviews, but the role is no longer needed because of AI.”

Then the boss appears.

## 14.3 Boss phases (3 phases)
Boss has HP, split into three phases:

### Phase 1 — Auto-complete Barrage
- Fires letter-shaped projectiles
- Periodically exposes core → pattern minigame:
  - Display 3-key pattern (e.g. A S D)
  - Player must press in order within a window
  - Success deals damage
  - Failure triggers shockwave and -1 heart

### Phase 2 — Refactor Slam
- Ground slam wave
- Player must jump/roll
- Pattern length becomes 4 keys

### Phase 3 — Bug Swarm
- Spawns small bugs chasing player
- Clear bugs via quick pattern or simple attack key
- Pattern speed increases slightly

## 14.4 Player weapon
- The keyboard: pattern minigame is the primary damage method.
- Patterns must stay short and readable.

## 14.5 Win condition & ending
When boss HP reaches 0:
Show final messages:
1) “Congrats on the new job! But the company shut down.”
2) “Good luck searching.”

Then go to `VictoryScene`.

## 14.6 Scoring Level 5
- Pattern success: +200 * multiplier
- Pattern failure: -75
- Completion: +4000
- Time bonus target **180s**
- No-heart-loss bonus: +800

---

# 15) UI / HUD Requirements
Global HUD in all gameplay scenes:
- Hearts (top-left)
- Score + Flow multiplier (top-right)
- Level indicator (top-center): “Stage 1/5”
- Small timer (optional): elapsed seconds

Dialog bubbles:
- Pixel speech bubble.
- Text must support Hebrew too (future), but English is fine for v1 UI text.

---

# 16) Assets (Placeholders allowed, but must be consistent)
The game must run end-to-end with placeholder assets.

### Minimum sprites
- Player: idle/walk (4-direction for Level 1; can reuse for other levels)
- Recruiter: idle
- Guard: walk
- Tiles: floor/walls/booths
- Cubes: base sprite + number text overlay
- Shelf slots: outlines
- Water: animated tile
- Snake: node segment sprite
- Rivals: 2–3 variants
- Boss spider: simple body + legs
- UI: heart filled/empty, button panels, speech bubble

### Minimum sounds
- Menu select
- Confirm
- Hit
- Success
- Level complete
- Game over
- Boss phase change

### Music
- Menu loop
- Gameplay loop
- Boss loop

---

# 17) Implementation Notes (Quality)
- Use delta-time independent movement.
- Avoid heavy allocations in update loops.
- Centralize input mapping (`InputManager`).
- Debug toggle via query string:
  - `?debug=1` shows hitboxes, guard FOV, BST constraints.
- Deterministic RNG option:
  - seed by date unless `?seed=123`.

---

# 18) Acceptance Criteria (Definition of Done)
Deliverable is complete when:
1) Menu loads and Start Game works.
2) Player can finish Level 1→2→3→4→5 in one run.
3) Hearts system works; death returns to GameOverScene with score.
4) Scoring updates live; combo multiplier works; mistakes break combo.
5) Victory shows ending messages and writes to local leaderboard.
6) No console errors.
7) Works on desktop Chrome/Edge/Firefox.

---

# 19) Default Balancing (Bootcamp)
Use as initial tuning:
- L1: `guardSpeed=60`, `detectionHoldMs=1000`, `recruiterCount=10`
- L2: `requiredPlacements=11`, `waterRisePxPerSec=6`, `waterPenaltyJumpPx=16`, `cubeCount=15`
- L3: `nodesCount=7`, `comboWindowMs=2000`, `snakeAttackIntervalMs=2500`
- L4: `rivalsCount=4`, `checkpointEveryPx=450`, fall penalty `-100`
- L5: `bossHP=12`, patternLen: phase1=3, phase2=4, phase3=4, `patternWindowMs=1600`

---

# 20) Output Expectation
Codex must generate:
- A working Vite + Phaser + TypeScript project
- All scenes implemented
- Placeholder assets included
- A README explaining:
  - `npm install`
  - `npm run dev`
  - `npm run build`

END.
