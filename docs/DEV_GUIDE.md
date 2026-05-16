# Development Guide

## Testing Multiplayer in Dev Mode (`DEV_MULTI_SEAT`)

### Overview

`DEV_MULTI_SEAT` is a feature flag that lets a single browser session act as all players in a room. This avoids needing multiple browsers/devices during local development.

**Enable it** by adding to `.env.local`:
```
NEXT_PUBLIC_DEV_MULTI_SEAT=true
```

It is only active in `NODE_ENV=development` — the flag is always false in production.

### How It Works

All players in a room share a single `user_id` (the one Supabase auth session). Normally, API routes identify "which player am I?" using `.eq("user_id", auth_user_id)`. With multiple players sharing a `user_id`, that query would return multiple rows and fail.

The fix is **player disambiguation via explicit player ID**:

**Client (`game/page.tsx`):**
- `effectiveMe` = whichever player's board tab is currently viewed (`viewingId`)
- When sending a pick, the body includes `_dev_player_id: effectiveMe.id`

**API routes:**
- When `DEV_MULTI_SEAT` is true and `_dev_player_id` is present, look up the player by `id` instead of `user_id`
- The roll route disambiguates differently (no `_dev_player_id` needed since only the active player rolls): it adds `.eq("seat_index", room.current_player_index)` to the query

### Testing Flow

1. Create a room, add 2–4 "players" (join the room multiple times in the same browser session — each join creates a separate `room_players` row under the same `user_id`)
2. Start the game
3. To act as a player: **click their board tab** — this sets `viewingId` and `effectiveMe` to that player
4. The active player's tab shows "Roll Dice" → roll first
5. Submit picks for each player by switching to their tab and clicking "Confirm Pick"
6. Once all players have submitted, the round advances automatically

### Rules for Maintaining DEV_MULTI_SEAT Compatibility

When writing a new API route that identifies the caller as a room player:

1. **Import the flag**: `import { DEV_MULTI_SEAT } from "@/lib/devFlags";`

2. **Parse the body early** (before the player lookup) so `_dev_player_id` is available

3. **Disambiguate the player query**:
```ts
let meQuery = supabase
  .from("room_players")
  .select("...")
  .eq("room_id", room.id);

if (DEV_MULTI_SEAT && typeof rawBody._dev_player_id === "string") {
  meQuery = meQuery.eq("id", rawBody._dev_player_id);
} else {
  meQuery = meQuery.eq("user_id", user.id);
}
```

4. **On the client**, include `_dev_player_id` in any request body that acts on behalf of a specific player:
```ts
body: JSON.stringify({
  ...payload,
  ...(DEV_MULTI_SEAT && { _dev_player_id: effectiveMe.id }),
})
```

### What Not to Do

- **Don't** use `maybeSingle()` after `.eq("user_id", user.id)` in a new route without the DEV_MULTI_SEAT guard — it will fail silently (returns `null` or errors) when multiple players share a `user_id`.
- **Don't** use `.limit(1)` as a workaround — it returns an arbitrary player row, not the intended one.
