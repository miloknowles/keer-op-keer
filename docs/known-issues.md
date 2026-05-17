# Known Issues

## Player name generation is limited

Guest players are assigned generic names that lack variety and personality.

**Fix options:**
- ~~Use the `coolnames` npm package~~ — using [`unique-names-generator`](https://www.npmjs.com/package/unique-names-generator) instead (generates names like "Realistic Llama", "Swift Falcon") ✓ Fixed
- Allow players to set a custom display name before joining

## Room code exhaustion

Room codes are 4 random uppercase letters (e.g. `XKQZ`), giving 26⁴ = 456,976 possible codes. If rooms are not cleaned up promptly after games end, the pool will eventually fill up and new rooms cannot be created.

**Fix options:**
- Periodically expire and free codes from finished/abandoned rooms
- Expand to 5-letter codes (26⁵ ≈ 11.8M) or add digits (36⁴ ≈ 1.7M)

## No automated CI testing

There is no GitHub Actions workflow to run the test suite on pull requests or pushes. Tests must be run manually (`npm test` from `app/`).

**Fix options:**
- Add a `.github/workflows/ci.yml` that runs `npm ci && npm test` in the `app/` directory on push/PR
- Optionally add type-checking (`npm run type-check`) and linting (`npm run lint`) as separate steps

## Auto-advance is unreliable

When all players have submitted their moves, the game should automatically advance to the next round, but this does not always trigger correctly. Players may be stuck waiting on a round that has already been completed by everyone.

**Fix options:**
- Audit the realtime subscription logic that listens for all-players-submitted and ensure it fires consistently
- Add a fallback server-side check (e.g. on each move submission, verify if all players are done and force-advance if so)

## Cannot rejoin an in-progress game

If a player navigates away or refreshes and then tries to re-enter their room code on the homepage, they see a "Game already started" error instead of being taken back to the game. Players who are already in `room_players` should be allowed to rejoin.

**Fix options:**
- In the `/join` API route, detect that the caller is already a member of the room and redirect them rather than returning an error
- On the homepage join form, check the user's existing room memberships first and route them directly if a match is found

## No mobile support

The game layout is designed for desktop and does not work on mobile screens. Significant layout restructuring would be needed to support small viewports.

**Fix options:**
- Enforce desktop-only by showing a "please use a desktop browser" message when the viewport is below a minimum width (e.g. 1024px), blocking access to the game UI
- Full mobile redesign (large effort)

## Logo does not link to home

Clicking "Keer op Keer 2" in the top-left header should navigate back to the main page (`/`), but currently does nothing.

**Fix options:**
- Enforce a hard cap of 6 players in the `/join` API route and surface a clear error message
- Test and validate the full game flow with 7+ players if higher limits are desired

## No game sounds

There is no audio feedback in the game — no sounds for dice rolls, cell placements, round advances, or game end. (Chat message notification sound added ✓)

**Fix options:**
- Add short sound effects for key events (dice roll, valid placement, invalid move, round end, game over) using the Web Audio API or a library like Howler.js
- Include a mute toggle in the UI

## Game ending is untested

The end-of-game flow (triggering game over, computing final scores, displaying results) has no automated test coverage.

**Fix options:**
- Add integration tests that simulate a full game through to completion and assert the correct winner and scores
- Add unit tests for the specific conditions that trigger game end (e.g. all columns filled, time expiry)
