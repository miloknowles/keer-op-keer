# Keer op Keer 2 — Game & Project Spec

Reference image: `docs/keer_op_keer_2.jpg`  
Board config: `boards/kok2-standard.json` (authoritative for all numeric values)  
Board types: `boards/board.types.ts`

## Overview

Keer op Keer 2 (KoK2) is a **roll-and-write dice game** by 999 Games for 1–6 players, ages 8+, ~15–30 min. Players roll dice each round, pick a color+number combination, and cross off cells on their personal score sheet. The player with the most points when the game ends wins.

This repo is an online multiplayer clone playable in the browser via real-time rooms.

---

## Game Mechanics

### Score Sheet

Each player has an identical score sheet — a **7 row × 15 column** colored grid (rows labeled P–V top-to-bottom, columns labeled A–O left-to-right). Column H is the center column and is highlighted; it is the mandatory starting column.

The grid contains cells in **5 colors**: pink, orange, yellow, green, blue. Cells are irregularly distributed. Some cells contain special icons:

- **Star cells** (☆) — if not crossed off at game end, each costs **−2 points**
- **Box cells** (!) — if not crossed off at game end, each scores **+1 point**
- **Heart cells** (♥) — crossing one off unlocks an additional bonus for that column

### Cell Placement Rules

- Crossed cells must **always be orthogonally adjacent** to at least one already-crossed cell.
- At the start of the game, **any cell in column H** is a valid first placement.
- Players build outward from their crossed region over the course of the game.
- **Exception — Bomb:** a bomb action crosses off any **2×2 block of cells anywhere** on the board, ignoring adjacency entirely.

### Heart Track

Each player's sheet has a **heart track** — 5 heart slots labeled 1 through 5, separate from the main grid.

**Earning hearts:** A player advances their heart track (crosses off the next slot) when they:
- Take the special die and it shows a Heart face, or
- Are the first to complete a row whose item is a heart

**Heart bonus on column completion:** Whenever a player completes a column, they earn their **current heart count as a bonus** on top of the column's printed first/subsequent value. So a player with 3 hearts crossed off gets +3 on every column they complete from that point forward.

This creates a compounding incentive: hearts earned early amplify all future column bonuses.

### Box Track

Each player's sheet has a row of **9 boxes** at the bottom. Players start with **1 box circled** (available). Boxes are the currency for using the special die.

**Earning boxes:** Circle the next uncircled box when you:
- Cross off a cell that has a box icon (!) on it, or
- Are the first to complete a row whose item is a box

**Spending boxes:** On your turn as active player, you may spend 1 box to use the special die instead of picking a color+number pair. Cross off (spend) one of your circled boxes.

The box track caps at 9. Uncircled boxes are unearned; there is no end-game scoring for boxes.

### Usable Items

Players can earn **bomb** items from completing rows. Bombs are held and can be spent on any future turn.

| Item | Effect when used |
|---|---|
| **Bomb** | Cross off any 2×2 block of cells anywhere (ignores adjacency) |

> **Still to verify:** whether bombs can be spent on any turn or only when you are the active player.

### Dice

KoK2 uses **7 dice**:

**3 number dice** — faces: `1 2 3 4 5 ?`
The `?` is a wildcard: the player who picks this die declares any value from 1–5 when they make their pick.

**3 color dice** — faces: `pink orange yellow green blue ✕`
The `✕` (black X) is a wildcard: the player who picks this die declares any color when they make their pick.

**1 special die** — 6 faces:

| Face | Count | Effect |
|---|---|---|
| Heart | 2 | Advance your heart track by 1 |
| Floodfill | 1 | Cross off an entire connected section of one color (however large) |
| Three-in-a-row | 1 | Cross off any 3 cells in a single horizontal row; each must touch your existing region but they don't need to touch each other |
| Bomb | 1 | Cross off any 2×2 block of cells anywhere (ignores adjacency) |
| Two stars | 1 | Cross off any 2 star cells anywhere on your sheet |

Wildcard rules apply equally to the active player and non-active players. When a player picks a `?` or `✕` die, the UI prompts them to declare their chosen value/color before confirming the pick. The declared value is what gets stored and acted on.

### Turn Structure

Each round, one player is the **active player**. Turns rotate clockwise.

1. **Active player rolls** all 7 dice.
2. **Active player chooses** one of:
   - **1 color die + 1 number die** → cross off that many cells of that color (adjacency rule applies)
   - **Spend 1 box** → use the special die result instead (requires ≥1 box on the track)
   - **Spend a held bomb** → use a previously earned bomb item
3. **All other players** each independently choose **2 dice** and apply that color+number combo to their own sheet.
4. Play passes to the next active player.

**Open dice rounds (rounds 1 and 2):** For the first two rounds of the game, all players — active and non-active — may pick freely from all 7 dice. There is no exclusive first pick and no restricted remaining pool. Starting from round 3, the active player's chosen dice are excluded from what non-active players may pick.

> In rounds 3+, non-active players are not competing with each other — each independently reads from the same remaining pool.

### Game End

The game ends when any player has completely crossed off **2 full colors**. All players finish the current round, then score.

### Scoring

#### Column bonuses (A–O)
When a player completes a column, they score:

> **printed bonus** (first or subsequent) **+ current heart count**

First player to complete a column earns the `first` value; all later completers earn `subsequent`. Both get the heart bonus added. Column H (center, easiest to reach) has a subsequent bonus of 0.

| Column | A | B | C | D | E | F | G | H | I | J | K | L | M | N | O |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| First | 5 | 3 | 3 | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 5 |
| Subsequent | 3 | 2 | 2 | 2 | 1 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 2 | 3 |

#### Row bonuses (P–V)
First player to cross off every cell in a row earns **5 points** and the row's item. Subsequent completers earn nothing.

| Row | P | Q | R | S | T | U | V |
|---|---|---|---|---|---|---|---|
| Points | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| Item | box | bomb | heart | bomb | box | heart | bomb |

#### Color bonuses
First player to cross off every cell of a color: **+5 pts**. Each subsequent player who also completes it: **+3 pts**.

#### End-game cell values
- Each uncrossed **star cell** (☆) on your sheet: **−2 pts**

---

## Online Multiplayer Design

### Rooms

- Players create or join a **game room** with a short code
- Rooms support 1–6 players
- One player is the **host** who starts the game
- Spectator mode — stretch goal

**Room code format:** 4 random uppercase letters (e.g. `XKQZ`). 26⁴ ≈ 456k combinations — sufficient for short-lived casual rooms. Chosen over human-readable names (e.g. `coolname`) because letter codes are faster to type, easier to read aloud unambiguously, and familiar from other party game platforms.

### Real-Time Sync

- Every dice roll is broadcast to all players via Supabase Realtime
- Each player's sheet is their own private state — only they can mark it, but everyone can see it (read-only for others)
- Non-active players see the dice pool and pick their 2 dice; UI enforces they cannot pick the active player's chosen dice
- Optional: per-turn timer for non-active player picks

### Game States

```
lobby → in_progress → scoring → finished
```

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js** (App Router) | SSR for lobby/auth, client components for game |
| Language | **TypeScript** | Strict mode |
| Styling | **Tailwind CSS** | Utility-first |
| Components | **shadcn/ui** | Accessible primitives |
| Database | **Supabase** (PostgreSQL) | Game rooms, player state, scores |
| Real-time | **Supabase Realtime** | Broadcast dice rolls, sync game state |
| Auth | **Supabase Auth** | Anonymous or email; guest play supported |
| Hosting | **Vercel** | Next.js native |

### Supabase Schema

```sql
-- Core room metadata. Kept lean — board config lives in room_boards.
rooms (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text UNIQUE NOT NULL,        -- short join code e.g. "XKQZ"
  host_id               uuid,                        -- FK → room_players.id (set after first join)
  status                text NOT NULL DEFAULT 'lobby',
                                                     -- 'lobby' | 'in_progress' | 'finished'
  current_player_index  int NOT NULL DEFAULT 0,
  round_number          int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  started_at            timestamptz,
  finished_at           timestamptz
)

-- One row per player per room.
room_players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid NOT NULL REFERENCES rooms(id),
  user_id         uuid REFERENCES auth.users(id),    -- null = anonymous/guest
  display_name    text NOT NULL,
  seat_index      int NOT NULL,                      -- turn order within the room

  -- Live game state (mutated as the game progresses)
  crossed_cells   text[] NOT NULL DEFAULT '{}',      -- cell keys e.g. {"A-P","B-Q"}
  hearts          int NOT NULL DEFAULT 0,            -- heart track progress (0–5)
  boxes           int NOT NULL DEFAULT 1,            -- available boxes on box track (0–9)
  bombs           int NOT NULL DEFAULT 0,            -- held bomb items

  -- End-game (populated when status → 'finished')
  score           int,
  score_breakdown jsonb,                             -- { columns, rows, colors, stars, ... }

  joined_at       timestamptz NOT NULL DEFAULT now()
)

-- Board config for a room. 1:1 with rooms, split out to keep rooms lightweight.
room_boards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      uuid UNIQUE NOT NULL REFERENCES rooms(id),
  template_id  text,                                -- e.g. "kok2-standard"; null = custom
  config       jsonb NOT NULL,                      -- full BoardConfig JSON
  created_at   timestamptz NOT NULL DEFAULT now()
)

-- Chat messages. Simple append-only log.
room_chats (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES rooms(id),
  player_id  uuid REFERENCES room_players(id),      -- null = system message
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)

-- One row per round. Source of truth for game replay and catch-up on reconnect.
room_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           uuid NOT NULL REFERENCES rooms(id),
  round_number      int NOT NULL,
  active_player_id  uuid NOT NULL REFERENCES room_players(id),

  -- The roll (always 7 dice). Stored as rolled — wildcards preserved as-is.
  dice_colors   text[3] NOT NULL,   -- e.g. {"pink","✕","orange"}  — "✕" = wildcard
  dice_numbers  text[3] NOT NULL,   -- e.g. {"3","?","5"}           — "?" = wildcard (text to allow "?")
  dice_special  text NOT NULL,      -- "heart"|"floodfill"|"three_in_a_row"|"bomb"|"two_stars"

  -- Active player's choice. If a wildcard die was picked, declared_color/declared_number
  -- record the player's chosen value; otherwise they match the die face.
  active_pick   jsonb NOT NULL,
    -- { type: "color_number", color_die: 0, number_die: 2,
    --   declared_color: "pink", declared_number: 3 }
    -- { type: "special" }          ← spent a box to use the special die
    -- { type: "bomb" }             ← spent a held bomb item

  -- Each non-active player's pick (keyed by room_players.id).
  -- Includes declared values for any wildcard dice.
  player_picks  jsonb NOT NULL DEFAULT '{}',
    -- { "<player_id>": { color_die: 1, number_die: 0,
    --                    declared_color: "blue", declared_number: 1 }, ... }

  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, round_number)
)
```

### Schema Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Sheet state location | Inline on `room_players` | State is small; simpler to update and read |
| Crossed cells type | `text[]` not jsonb | Append-friendly, compact, membership check is fast |
| Board config location | Separate `room_boards` | Config is large; keeps `rooms` fast for lobby queries |
| History granularity | One row per round | Rounds are atomic; enough to reconstruct full game state |
| Dice storage | Typed columns not jsonb | Enforces structure; easier to query individual values |

### Realtime Subscriptions

| Table | Event | Client action |
|---|---|---|
| `room_history` | INSERT | New round: show dice result, open pick UI |
| `room_players` | UPDATE | Re-render that player's sheet and resource tracks |
| `room_chats` | INSERT | Append message to chat |
| `rooms` | UPDATE | Handle status transitions (lobby → in progress → finished) |

### Directory Structure

```
keer-op-keer/
├── app/                         # Next.js application
│   └── src/
│       ├── app/                 # App Router pages
│       │   ├── page.tsx         # Landing / create or join room
│       │   ├── room/[code]/
│       │   │   └── page.tsx     # Game room (lobby + game + scoring)
│       │   └── layout.tsx
│       ├── components/
│       │   ├── game/            # ScoreSheet, Cell, DiceRoller, DicePicker, etc.
│       │   └── ui/              # shadcn primitives
│       ├── lib/
│       │   ├── supabase/        # browser client, server client, middleware
│       │   └── game/            # pure game logic (no React)
│       │       ├── sheet.ts     # grid layout, color map, special cell positions
│       │       ├── dice.ts      # dice types, roll simulation, special die faces
│       │       ├── rules.ts     # validate a move (adjacency, color match, count)
│       │       └── scoring.ts   # compute final score from sheet state
│       └── types/
│           └── game.ts          # shared TypeScript types
├── boards/                      # board configuration files
│   ├── board.types.ts           # TypeScript types for BoardConfig
│   └── kok2-standard.json       # standard KoK2 board (authoritative values)
├── supabase/                    # migrations, seed, config
└── docs/
    ├── SPEC.md
    └── keer_op_keer_2.jpg
```

---

## Open Questions

1. **Exact grid color layout** — need to map each (col, row) cell to its color; currently a placeholder in `kok2-standard.json`
2. **Star / box / heart cell counts and positions** — how many of each special cell, and where
3. **Floodfill scope** — does it fill all cells of that color everywhere on the board, or just one contiguous region?
4. **Three-in-a-row adjacency** — must all 3 cells individually touch the existing region, or just at least one of the 3?
5. **Item usage timing** — can items be played on any turn, or only when you are the active player?
7. **Turn timer** — should non-active players have a time limit to pick their dice?
8. **Anonymous play** — support playing without an account?
