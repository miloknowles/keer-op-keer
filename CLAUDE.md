# Keer op Keer 2 — Codebase Guide

An online multiplayer browser clone of the roll-and-write dice game Keer op Keer 2. See `docs/SPEC.md` for game rules and `docs/PLAN.md` for the implementation roadmap.

## Repo layout

```
app/                  Next.js application
  src/
    boards/           Board configuration
      board.types.ts  TypeScript types for BoardConfig, BoardCell, Color, etc.
      kok2-standard.json  Standard KoK2 board (authoritative for all numeric values)
    types/game.ts     All shared game types (re-exports from boards/board.types)
    lib/game/         Pure game logic — no React, no Supabase
      dice.ts         Constants and rollDice()
      sheet.ts        Grid helpers (adjacency, flood-fill, completion checks)
      rules.ts        Server-authoritative move validation
      scoring.ts      End-game score computation
    lib/supabase/     Browser + server Supabase clients
    app/              Next.js App Router pages and API routes
  vitest.config.ts    Test runner config
docs/
  SPEC.md             Complete game rules and architecture spec
  PLAN.md             Phased implementation plan (✓ = complete)
supabase/             Database migrations
```

## MCP servers

A Supabase MCP server is configured in `.mcp.json` at the repo root. It gives Claude direct access to the project's database, migrations, storage, and logs. Restart Claude Code to activate it if it isn't already loaded.

## Commands

All from the `app/` directory:

```bash
npm run dev       # Start dev server on localhost:3000
npm test          # Run all unit tests (vitest)
npm run test:watch  # Watch mode
npm run build     # Production build
```

## Import aliases

One path alias is configured in `tsconfig.json` and `vitest.config.ts`:

- `@/*` → `app/src/*`

Use `@/boards/board.types` and `@/boards/kok2-standard.json` everywhere — not relative paths. Same for types and hooks: `@/types/presence`, `@/hooks/use-presence`, etc.

## Key implementation notes

**Board JSON format:** `app/src/boards/kok2-standard.json` uses `{ "special": "star" }` and `{ "special": "box" }` on cells with icons, matching the `BoardCell` TypeScript type. Do not use the old `{ "star": true }` boolean format.

**Game logic is stateless:** `lib/game/` functions take plain data (config, crossed_cells array) and return plain data. They have no side effects and are safe to call from both API routes and client components.

**Adjacency:** CellKey format is `"COL-ROW"` (e.g. `"H-P"`). Adjacency is orthogonal only (N/E/S/W). Exception: Bomb ignores adjacency entirely.

**First placement:** When `crossed_cells` is empty, valid cells are any in `config.grid.startColumns` (column H on the standard board).

**Available boxes:** `boxes_unlocked - boxes_spent` (not just `boxes_unlocked`).

**Scoring first-vs-subsequent:** Determined by the index of the last cell of a group within each player's `crossed_cells` array — the player whose last cell appears at the smallest index completed the group first.

**Presence system:** Realtime cursor tracking via `usePresence()` hook and Supabase Realtime Presence. The `PlayerPresence` type is extensible — add fields to `types/presence.ts` to support future indicators (e.g. "considering this color", typing state). Cursor updates are throttled to 150ms on the client. See `docs/SPEC.md` for full details.

## Development workflow

**Do not run `npm run build` while the dev server is running** — it will crash the hot-reloading dev build. For builds during active development, use `npm run type-check` or `npm run lint` instead. Full builds should only run when the dev server is stopped.
