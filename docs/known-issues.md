# Known Issues

## Room code exhaustion

Room codes are 4 random uppercase letters (e.g. `XKQZ`), giving 26⁴ = 456,976 possible codes. If rooms are not cleaned up promptly after games end, the pool will eventually fill up and new rooms cannot be created.

**Fix options:**
- Periodically expire and free codes from finished/abandoned rooms
- Expand to 5-letter codes (26⁵ ≈ 11.8M) or add digits (36⁴ ≈ 1.7M)

## Auto-advance is unreliable

When all players have submitted their moves, the game should automatically advance to the next round, but this does not always trigger correctly. Players may be stuck waiting on a round that has already been completed by everyone.

**Fix options:**
- Audit the realtime subscription logic that listens for all-players-submitted and ensure it fires consistently
- Add a fallback server-side check (e.g. on each move submission, verify if all players are done and force-advance if so)

