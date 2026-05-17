import { describe, it, expect } from "vitest";
import { generateBoard } from "@/lib/game/generate-board";
import type { Color } from "@/boards/board.types";

const COLORS: Color[] = ["p", "o", "y", "g", "b"];

describe("generateBoard", () => {
  it("same seed produces identical boards", () => {
    expect(generateBoard(42)).toEqual(generateBoard(42));
  });

  it("different seeds produce different cell layouts", () => {
    expect(generateBoard(42).cells).not.toEqual(generateBoard(43).cells);
  });

  it("all 105 cells are present", () => {
    expect(Object.keys(generateBoard(1).cells)).toHaveLength(105);
  });

  it("each color has 19–23 cells", () => {
    const board = generateBoard(1);
    for (const color of COLORS) {
      const count = Object.values(board.cells).filter(c => c.color === color).length;
      expect(count).toBeGreaterThanOrEqual(19);
      expect(count).toBeLessThanOrEqual(23);
    }
  });

  it("has exactly 12 star cells", () => {
    const stars = Object.values(generateBoard(1).cells).filter(c => c.special === "star").length;
    expect(stars).toBe(12);
  });

  it("has exactly 5 box cells", () => {
    const boxes = Object.values(generateBoard(1).cells).filter(c => c.special === "box").length;
    expect(boxes).toBe(5);
  });

  it("no cell has both star and box", () => {
    const board = generateBoard(1);
    const starKeys = new Set(
      Object.entries(board.cells).filter(([, c]) => c.special === "star").map(([k]) => k),
    );
    const boxKeys = new Set(
      Object.entries(board.cells).filter(([, c]) => c.special === "box").map(([k]) => k),
    );
    for (const k of starKeys) expect(boxKeys.has(k)).toBe(false);
  });

  it("grid structure matches standard board", () => {
    const board = generateBoard(1);
    expect(board.grid.columns).toHaveLength(15);
    expect(board.grid.rows).toHaveLength(7);
    expect(board.grid.startColumns).toContain("H");
  });

  it("no contiguous same-color region exceeds 6 cells", () => {
    const board = generateBoard(1);
    const assignment: Record<string, string> = {};
    for (const [k, cell] of Object.entries(board.cells)) assignment[k] = cell.color;

    const COLUMNS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O"];
    const ROWS = ["P","Q","R","S","T","U","V"];

    function neighbors(key: string): string[] {
      const [col, row] = key.split("-");
      const c = COLUMNS.indexOf(col), r = ROWS.indexOf(row);
      const out: string[] = [];
      if (c > 0) out.push(`${COLUMNS[c-1]}-${ROWS[r]}`);
      if (c < 14) out.push(`${COLUMNS[c+1]}-${ROWS[r]}`);
      if (r > 0) out.push(`${COLUMNS[c]}-${ROWS[r-1]}`);
      if (r < 6) out.push(`${COLUMNS[c]}-${ROWS[r+1]}`);
      return out;
    }

    const visited = new Set<string>();
    for (const [start, color] of Object.entries(assignment)) {
      if (visited.has(start)) continue;
      const stack = [start];
      let size = 0;
      while (stack.length > 0) {
        const curr = stack.pop()!;
        if (visited.has(curr)) continue;
        visited.add(curr);
        size++;
        for (const nb of neighbors(curr)) {
          if (!visited.has(nb) && assignment[nb] === color) stack.push(nb);
        }
      }
      expect(size).toBeLessThanOrEqual(6);
    }
  });

  it("scoring is inherited from the standard board", () => {
    const board = generateBoard(1);
    expect(board.scoring.starPenalty).toBe(-2);
    expect(board.scoring.colorCompletion.first).toBe(5);
    expect(board.scoring.gameEnd.colorsCompleted).toBe(2);
  });

  it("works for 20 consecutive seeds without throwing", () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(() => generateBoard(seed)).not.toThrow();
    }
  });
});
