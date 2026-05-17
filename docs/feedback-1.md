# Playtesting Feedback — Session 1

## Date


## Participants


## What Worked Well


## Issues / Bugs

- **Leave room doesn't work** — clicking "Leave room" in the lobby navigated the player home but never removed them from `room_players`, so they remained visible to everyone else. Fixed: button now calls `DELETE /api/rooms/{code}/players/{me.id}` before navigating; API was also updated to allow self-deletion (it previously only let the host kick others). *(Fixed)*

- **"Can't pick yet" shown during open rounds** — in rounds 1–2, all players can pick freely, but the sidebar showed "Can't pick yet" for non-active players as if they had to wait for the active player to go first. *(Fixed)*

- **"Waiting for their pick" shown for yourself** — the sidebar label used "their" even when the row was the current player. *(Fixed: now says "Waiting for your pick")*

- **Brief flash between Roll Dice button and dice appearing** — after clicking Roll, the spinner disappeared a moment before the dice appeared, leaving a blank area. Caused by `setRolling(false)` firing on fetch completion while the Realtime event for the dice roll hadn't arrived yet. *(Fixed)*

## UX / UI Notes

- **Removed "{player} goes first" indicator** — the header showed the active player's name with "goes first" while picks were pending. Removed as it was redundant / confusing.

## Game Balance / Rules Notes


## Action Items

