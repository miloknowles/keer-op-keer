# Keer op Keer 2 — Codebase Guide

An online multiplayer browser clone of the roll-and-write dice game Keer op Keer 2. See `docs/SPEC.md` for game rules and `docs/PLAN.md` for the implementation roadmap.

## Repo layout

```
boards/               Board configuration (shared; used by app and tests)
  board.types.ts      TypeScript types for BoardConfig, BoardCell, Color, etc.
  kok2-standard.json  Standard KoK2 board (authoritative for all numeric values)
app/                  Next.js application
  src/
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

## Commands

All from the `app/` directory:

```bash
npm run dev       # Start dev server on localhost:3000
npm test          # Run all unit tests (vitest)
npm run test:watch  # Watch mode
npm run build     # Production build
```

## Import aliases

Two path aliases are configured in `tsconfig.json`, `vitest.config.ts`, and `next.config.ts`:

- `@/*` → `app/src/*`
- `@boards/*` → `boards/*` (monorepo root)

Use `@boards/board.types` and `@boards/kok2-standard.json` everywhere — not relative paths.

## Key implementation notes

**Board JSON format:** `boards/kok2-standard.json` uses `{ "special": "star" }` and `{ "special": "box" }` on cells with icons, matching the `BoardCell` TypeScript type. Do not use the old `{ "star": true }` boolean format.

**Game logic is stateless:** `lib/game/` functions take plain data (config, crossed_cells array) and return plain data. They have no side effects and are safe to call from both API routes and client components.

**Adjacency:** CellKey format is `"COL-ROW"` (e.g. `"H-P"`). Adjacency is orthogonal only (N/E/S/W). Exception: Bomb ignores adjacency entirely.

**First placement:** When `crossed_cells` is empty, valid cells are any in `config.grid.startColumns` (column H on the standard board).

**Available boxes:** `boxes_unlocked - boxes_spent` (not just `boxes_unlocked`).

**Scoring first-vs-subsequent:** Determined by the index of the last cell of a group within each player's `crossed_cells` array — the player whose last cell appears at the smallest index completed the group first.
