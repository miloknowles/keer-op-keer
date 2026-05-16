# Development Guide

## Testing Multiplayer in Dev Mode

### The Impersonation Problem

When testing multiplayer gameplay locally, you might open two browser tabs to simulate different players. **This does not work as-is** because:

1. Each browser tab maintains its own **Supabase session** (independent `auth.getUser()` result)
2. API routes authenticate requests using the Supabase session cookie: `supabase.auth.getUser()`
3. When you create a room in Tab 1, the `room_players` row is created with Tab 1's `user_id`
4. When you open Tab 2 (a different session), it has a different `user_id`, so the pick route will not find the player in the room → "Not in room" error

### Solution: Use Multiple Browsers or Devices

To properly test multiplayer:

- **Option 1 (Best for local dev):** Open the app in **two different browsers** (e.g., Chrome and Firefox) or in **one private/incognito window and one normal window**. Each browser context maintains a separate Supabase session, so they will have different `user.id` values.

- **Option 2 (For remote testing):** Deploy to staging and test with actual devices/users. Each device will have its own session.

- **Option 3 (If you really need same-browser testing):** You'd need to add dev-mode-only API endpoints that can impersonate a player ID in a room, then pass that ID to the client via query param or localStorage. This is complex and not recommended — use Option 1 instead.

### What Happens Under the Hood

1. Landing page (`/`) uses Supabase anonymous auth. Each tab gets assigned a unique anonymous `user_id`.
2. When you join a room, a `room_players` row is inserted with your `user_id`.
3. API routes (roll, pick, etc.) call `supabase.auth.getUser()` and look up the player row using that `user_id`.
4. If the `user_id` is not in the room → 403 "Not in room" error.

Same-tab impersonation would require modifying the Supabase session cookie or the auth state in the client, which is fragile and breaks the real auth flow.

### Debug Tips

If you see "Not in room" errors:

1. Check the browser console for the error message from the API
2. Verify you're using **different browser contexts** (check DevTools → Application → Cookies → confirm different session tokens)
3. Refresh the page to ensure the session is loaded before interacting with the game
4. In the Supabase dashboard, check the `room_players` table: verify both player rows exist with different `user_id` values
