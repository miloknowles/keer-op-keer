import type { BoardConfig } from "@/boards/board.types";
import type {
  ColorNumberPick,
  SpecialPick,
  GamePick,
  DiceRoll,
  RoomPlayerRow,
} from "../../types/game";
import { isColorWildcard, isNumberWildcard } from "./dice";
import {
  getCell,
  getAdjacentCells,
  isValidPlacement,
  getConnectedRegion,
  areCellsContiguous,
} from "./sheet";

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

function ok(): ValidationResult {
  return { valid: true };
}
function fail(error: string): ValidationResult {
  return { valid: false, error };
}

export function validateBombCells(
  config: BoardConfig,
  cells: string[],
): ValidationResult {
  if (cells.length !== 4) return fail("bomb requires exactly 4 cells");
  for (const key of cells) {
    if (!getCell(config, key))
      return fail(`cell ${key} does not exist on board`);
  }
  // Verify cells form a 2×2 block
  const cols = cells.map((k) => config.grid.columns.indexOf(k.split("-")[0]));
  const rows = cells.map((k) => config.grid.rows.indexOf(k.split("-")[1]));
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  if (maxCol - minCol !== 1 || maxRow - minRow !== 1)
    return fail("bomb cells must form a 2×2 block");
  // Ensure all four corners of that block are present
  const keys = new Set(cells);
  const c1 = config.grid.columns[minCol],
    c2 = config.grid.columns[maxCol];
  const r1 = config.grid.rows[minRow],
    r2 = config.grid.rows[maxRow];
  for (const c of [c1, c2]) {
    for (const r of [r1, r2]) {
      if (!keys.has(`${c}-${r}`))
        return fail("bomb cells must form a complete 2×2 block");
    }
  }
  return ok();
}

export function validateColorNumberPick(
  config: BoardConfig,
  pick: ColorNumberPick,
  roll: DiceRoll,
  player: RoomPlayerRow,
  activePick: GamePick | null,
  isActivePlayer: boolean,
  round: number,
): ValidationResult {
  const { color_die, number_die, declared_color, declared_number, cells } =
    pick;

  // Valid die indices
  if (![0, 1, 2].includes(color_die)) return fail("invalid color_die index");
  if (![0, 1, 2].includes(number_die)) return fail("invalid number_die index");

  // In rounds 3+, non-active players cannot use the dice the active player used
  if (round >= 3 && !isActivePlayer) {
    if (activePick === null) return fail("active player has not yet picked");
    if (activePick.type === "color_number") {
      if (color_die === activePick.color_die)
        return fail("color die already used by active player");
      if (number_die === activePick.number_die)
        return fail("number die already used by active player");
    }
  }

  // Wildcard accounting
  const colorFace = roll.colors[color_die];
  const numberFace = roll.numbers[number_die];
  const colorIsWild = isColorWildcard(colorFace);
  const numberIsWild = isNumberWildcard(numberFace);
  const wildcardsNeeded = (colorIsWild ? 1 : 0) + (numberIsWild ? 1 : 0);
  if (wildcardsNeeded > player.wildcards) return fail("not enough wildcards");

  // Declared color matches die unless wildcard
  if (!colorIsWild && colorFace !== declared_color) {
    return fail(
      `declared_color (${declared_color}) does not match color die face (${colorFace})`,
    );
  }

  // Declared number is valid
  if (declared_number < 1 || declared_number > 5)
    return fail("declared_number must be 1–5");
  if (!numberIsWild && numberFace !== String(declared_number)) {
    return fail(
      `declared_number (${declared_number}) does not match number die face (${numberFace})`,
    );
  }

  // Cell count matches declared number
  if (cells.length !== declared_number) {
    return fail(
      `must cross off exactly ${declared_number} cells, got ${cells.length}`,
    );
  }

  const crossedSet = new Set(player.crossed_cells);

  for (const key of cells) {
    const cell = getCell(config, key);
    if (!cell) return fail(`cell ${key} does not exist on board`);
    if (cell.color !== declared_color)
      return fail(`cell ${key} is not color ${declared_color}`);
    if (crossedSet.has(key)) return fail(`cell ${key} is already crossed`);
  }

  // Adjacency / start condition — each cell must independently satisfy placement rules
  // Build incrementally: as cells are "placed" they join the region for subsequent cells
  const buildingCrossed = [...player.crossed_cells];
  for (const key of cells) {
    if (!isValidPlacement(config, key, buildingCrossed)) {
      return fail(`cell ${key} is not adjacent to existing region`);
    }
    buildingCrossed.push(key);
  }

  // Contiguity check — all selected cells must form a single connected group
  if (!areCellsContiguous(config, cells)) {
    return fail("selected cells must form a single contiguous group");
  }

  // Bomb cells from row completion
  if (pick.bomb_cells && pick.bomb_cells.length > 0) {
    const bombResult = validateBombCells(config, pick.bomb_cells);
    if (!bombResult.valid) return fail(`bomb_cells: ${bombResult.error}`);
    // Bomb cells must not already be crossed (including the cells just placed above)
    const allCrossedAfterPick = new Set(buildingCrossed);
    for (const bk of pick.bomb_cells) {
      if (allCrossedAfterPick.has(bk))
        return fail(`bomb cell ${bk} is already crossed`);
    }
  }

  return ok();
}

export function validateSpecialPick(
  config: BoardConfig,
  pick: SpecialPick,
  roll: DiceRoll,
  player: RoomPlayerRow,
): ValidationResult {
  const availableBoxes = player.boxes_unlocked - player.boxes_spent;
  if (availableBoxes < 1) return fail("no boxes available");

  const crossedSet = new Set(player.crossed_cells);
  const { cells } = pick;

  switch (roll.special) {
    case "heart": {
      if (cells.length !== 0) return fail("heart pick must have no cells");
      break;
    }

    case "fill": {
      if (cells.length === 0)
        return fail("fill must include at least one cell");
      // All cells must be uncrossed and exist on board
      for (const key of cells) {
        if (!getCell(config, key))
          return fail(`cell ${key} does not exist on board`);
        if (crossedSet.has(key)) return fail(`cell ${key} is already crossed`);
      }
      // All cells must be same color
      const color = getCell(config, cells[0])!.color;
      for (const key of cells) {
        if (getCell(config, key)!.color !== color)
          return fail("fill cells must all be the same color");
      }
      // Cells must form a connected region
      const connected = getConnectedRegion(
        config,
        color,
        cells[0],
        player.crossed_cells,
      );
      const connectedSet = new Set(connected);
      for (const key of cells) {
        if (!connectedSet.has(key))
          return fail(`fill cells are not a fully connected same-color region`);
      }
      if (connected.length !== cells.length) {
        return fail(
          "fill must cross off the entire connected region, not a subset",
        );
      }
      // At least one cell must be adjacent to existing region (or start condition)
      const anyValid = cells.some((key) =>
        isValidPlacement(config, key, player.crossed_cells),
      );
      if (!anyValid)
        return fail("fill region must be adjacent to existing crossed region");
      break;
    }

    case "three_in_a_row": {
      if (cells.length !== 3)
        return fail("three_in_a_row requires exactly 3 cells");
      const rows = cells.map((k) => k.split("-")[1]);
      if (new Set(rows).size !== 1)
        return fail("three_in_a_row cells must all be in the same row");
      for (const key of cells) {
        if (!getCell(config, key))
          return fail(`cell ${key} does not exist on board`);
        if (crossedSet.has(key)) return fail(`cell ${key} is already crossed`);
        if (!isValidPlacement(config, key, player.crossed_cells)) {
          return fail(`cell ${key} is not adjacent to existing region`);
        }
      }
      break;
    }

    case "bomb": {
      if (cells.length !== 4) return fail("bomb requires exactly 4 cells");
      for (const key of cells) {
        if (crossedSet.has(key)) return fail(`cell ${key} is already crossed`);
      }
      const bombResult = validateBombCells(config, cells);
      if (!bombResult.valid) return bombResult;
      break;
    }

    case "two_stars": {
      if (cells.length !== 2) return fail("two_stars requires exactly 2 cells");
      for (const key of cells) {
        const cell = getCell(config, key);
        if (!cell) return fail(`cell ${key} does not exist on board`);
        if (cell.special !== "star")
          return fail(`cell ${key} is not a star cell`);
        if (crossedSet.has(key)) return fail(`cell ${key} is already crossed`);
      }
      break;
    }
  }

  // Bomb cells from row completion
  if (pick.bomb_cells && pick.bomb_cells.length > 0) {
    const bombResult = validateBombCells(config, pick.bomb_cells);
    if (!bombResult.valid) return fail(`bomb_cells: ${bombResult.error}`);
    const allCrossedAfterPick = new Set([...player.crossed_cells, ...cells]);
    for (const bk of pick.bomb_cells) {
      if (allCrossedAfterPick.has(bk))
        return fail(`bomb cell ${bk} is already crossed`);
    }
  }

  return ok();
}

// Returns true only when the player has no legal color+number move and no box to spend.
export function canPass(
  config: BoardConfig,
  roll: DiceRoll,
  player: RoomPlayerRow,
  activePick: GamePick | null,
  isActivePlayer: boolean,
  round: number,
): boolean {
  if (player.boxes_unlocked - player.boxes_spent >= 1) return false;

  // Try every color×number die combination
  for (let ci = 0; ci < 3; ci++) {
    for (let ni = 0; ni < 3; ni++) {
      const colorFace = roll.colors[ci];
      const numberFace = roll.numbers[ni];
      const colorIsWild = isColorWildcard(colorFace);
      const numberIsWild = isNumberWildcard(numberFace);
      const wildcardsNeeded = (colorIsWild ? 1 : 0) + (numberIsWild ? 1 : 0);
      if (wildcardsNeeded > player.wildcards) continue;

      // Colors to try
      const colorsToTry: string[] = colorIsWild
        ? ["p", "o", "y", "g", "b"]
        : [colorFace];
      // Numbers to try
      const numbersToTry: number[] = numberIsWild
        ? [1, 2, 3, 4, 5]
        : [parseInt(numberFace)];

      for (const dc of colorsToTry) {
        for (const dn of numbersToTry) {
          // Check if there are enough valid cells to place
          const candidatePick: ColorNumberPick = {
            type: "color_number",
            color_die: ci as 0 | 1 | 2,
            number_die: ni as 0 | 1 | 2,
            declared_color: dc as import("@/boards/board.types").Color,
            declared_number: dn,
            cells: [],
          };
          // Find `dn` valid cells of color `dc` adjacent to region
          const potentialCells = Object.keys(config.cells).filter((key) => {
            const cell = config.cells[key];
            return (
              cell.color === dc &&
              !player.crossed_cells.includes(key) &&
              isValidPlacement(config, key, player.crossed_cells)
            );
          });
          if (potentialCells.length >= dn) {
            // A move exists — cannot pass
            // Verify dice restriction for rounds 3+
            if (
              round >= 3 &&
              !isActivePlayer &&
              activePick?.type === "color_number"
            ) {
              if (ci === activePick.color_die || ni === activePick.number_die)
                continue;
            }
            return false;
          }
        }
      }
    }
  }
  return true;
}
