# Bot Framework

Bots are AI-controlled players that join rooms alongside humans. They are stored as normal `room_players` rows with `is_bot = true` and auto-play every turn without any browser session.

## Schema

```sql
ALTER TABLE public.room_players
  ADD COLUMN is_bot   boolean NOT NULL DEFAULT false,
  ADD COLUMN bot_type text;     -- e.g. "greedy"; null for humans
```

Bots have `user_id = null`. The service-role client is used wherever bots write to the DB so that RLS (which requires a `user_id`) is bypassed.

## File Layout

```
app/src/lib/bots/
  types.ts      BotContext and BotStrategy interfaces
  greedy.ts     GreedyBot — the only strategy in v1
  index.ts      Registry; getBotStrategy(type)
  runner.ts     Orchestrator; handleBotRound()
app/src/lib/supabase/
  service.ts    Service-role Supabase client (server-only)
app/src/app/api/rooms/[code]/
  add-bot/route.ts  POST — add a bot to a lobby
```

## Execution Flow

### Human rolls → non-active bots pick

```
POST /api/rooms/[code]/roll
  ↓ inserts room_history row
  ↓ handleBotRound(roomId)   ← fire-and-forget
      non-active bots that haven't picked yet → runBotPick()
      maybe_advance_round RPC
        "advanced"   → handleBotRound(roomId, depth+1)
        "game_ends"  → computeScore for all players
        "not_complete" → done (waiting for humans)
```

### Human advances → active bot auto-rolls and picks

```
POST /api/rooms/[code]/advance
  ↓ maybe_advance_round RPC → "advanced"
  ↓ handleBotRound(roomId)   ← fire-and-forget
      if active player is a bot and no history row:
        rollDice() → insert room_history (auto-roll)
      if active bot hasn't picked yet → runBotPick(isActivePlayer=true)
      reload active_pick
      non-active bots that haven't picked yet → runBotPick(isActivePlayer=false)
      maybe_advance_round RPC  (recurse if needed)
```

`handleBotRound` uses a `depth` counter (max 200) to guard against infinite recursion when a game has consecutive all-bot rounds.

### Non-active bots and round ordering (round ≥ 3)

From round 3 onward, non-active players must exclude the two dice indices used by the active player. If the active pick isn't available yet when `handleBotRound` runs, non-active bots wait — the function returns early and will be re-triggered on the next advance.

## Adding a New Strategy

1. Create `app/src/lib/bots/<name>.ts` exporting a class that implements `BotStrategy`:

   ```ts
   import type { BotContext, BotStrategy } from "./types";
   import type { GamePick } from "@/types/game";

   export class MyBot implements BotStrategy {
     readonly type = "my_bot";
     choosePick(ctx: BotContext): GamePick {
       // ...return a pick or { type: "pass" }
     }
   }
   ```

2. Register it in `app/src/lib/bots/index.ts`:

   ```ts
   import { MyBot } from "./my_bot";
   const REGISTRY: Record<string, BotStrategy> = {
     greedy: new GreedyBot(),
     my_bot: new MyBot(),
   };
   ```

3. The new type will automatically appear in `BOT_TYPES` and be accepted by `POST /add-bot`.

## Greedy Strategy

`GreedyBot` maximises immediate cell value. For each of the 9 (color_die, number_die) index pairs it:

1. Skips wildcard faces (v1 simplification — bots never use wildcards).
2. Skips dice excluded by the active player (rounds ≥ 3, non-active case).
3. Calls `findBestGroup` to locate the highest-scoring contiguous group of `declared_number` cells of `declared_color`.
4. Picks the pair with the highest group score.

**Group scoring** (`scoreGroup`):
- `+0.1 × cell_count` — tie-break, prefer larger groups
- `+2` per star cell — avoids the −2 end-game penalty
- `+1` per box cell — gains a box token
- `+5` if any row transitions from incomplete to complete
- `+(first + subsequent) / 2` for each column or color that completes (average used because first/subsequent status isn't predictable)

**Group finding** (`findBestGroup` + `greedyExtend`):
- Seeds from every valid-placement uncrossed cell of the target color.
- Greedily extends by always adding the highest-value adjacent uncrossed same-color neighbour.
- Verifies contiguity with `areCellsContiguousWithBridge`.
- Returns the seed's group with the highest `scoreGroup`.

**Bomb handling**: if the chosen group would complete a bomb row, `findBestBombBlock` finds the best available 2×2 block (preferring blocks with star cells). If no block is available the pick is skipped.

Returns `{ type: "pass" }` if no valid pick is found.

## Validation Safety Net

`runner.ts` validates every non-pass pick via `validateColorNumberPick` / `validateSpecialPick` before writing it. If the strategy returns an invalid pick (e.g. a logic bug), the runner logs a warning and submits `{ type: "pass" }` instead, so an invalid bot never breaks the game.

## Service-Role Client

`app/src/lib/supabase/service.ts` creates a Supabase client with the `SUPABASE_SERVICE_ROLE_KEY`. This key must be set in `.env.local` (and Vercel env) and is **never** prefixed `NEXT_PUBLIC_` — it stays server-only. The service client bypasses RLS, which is necessary because bot rows have `user_id = null`.

## Adding a Bot (API)

```
POST /api/rooms/[code]/add-bot
Authorization: caller must be authenticated and be the room host
Room must be in "lobby" status

Body (optional):
  { "bot_type": "greedy" }   ← defaults to "greedy" if omitted or invalid

Response:
  { "player_id": "<uuid>" }
```

Bots count toward the room's 6-player maximum. The lobby UI shows a "BOT" badge on bot players and an "Add Bot" button visible only to the host.
