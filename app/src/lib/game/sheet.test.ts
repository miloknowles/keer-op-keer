import { describe, it, expect } from "vitest";
import type { BoardConfig } from "@/boards/board.types";
import {
  getCell,
  getCellsOfColor,
  isColumnComplete,
  isRowComplete,
  isColorComplete,
  getAdjacentCells,
  isAdjacentToRegion,
  isValidPlacement,
  getConnectedRegion,
  colorsCompleted,
  uncrossedStars,
} from "./sheet";

// Import the real board config as the test fixture
import rawBoard from "@/boards/kok2-standard.json";
const config = rawBoard as unknown as BoardConfig;

// Board facts:
// - 15 columns (A-O), 7 rows (P-V), startColumns: ['H']
// - A-P: pink (corner — adjacent to B-P and A-Q only)
// - H-P: green (start column, adjacent to G-P, I-P, H-Q)
// - H-R: orange, special:star (adjacent to G-R, I-R, H-Q, H-S — 4 neighbors)
// - Orange connected to H-R: E-Q, F-Q, F-R, G-R, H-R (5 cells)
// - Star cells: 12 total including C-P, F-P, H-R, J-Q, B-S, D-S, G-U, L-P, M-S, N-U, E-V, I-V

describe("getCell", () => {
  it("returns the cell for a valid key", () => {
    expect(getCell(config, "H-P")).toEqual({ color: "g" });
  });

  it("returns undefined for a non-existent key", () => {
    expect(getCell(config, "Z-Z")).toBeUndefined();
  });
});

describe("getCellsOfColor", () => {
  it("returns only cells matching the given color", () => {
    const pinkCells = getCellsOfColor(config, "p");
    expect(pinkCells.length).toBeGreaterThan(0);
    for (const key of pinkCells) {
      expect(config.cells[key].color).toBe("p");
    }
  });

  it("returns 105 cells total across all colors", () => {
    const total = (["p", "o", "y", "g", "b"] as const).flatMap((c) =>
      getCellsOfColor(config, c),
    );
    expect(total).toHaveLength(105);
  });
});

describe("getAdjacentCells", () => {
  it("corner cell A-P has 2 neighbors", () => {
    const adj = getAdjacentCells(config, "A-P");
    expect(adj).toHaveLength(2);
    expect(adj).toContain("B-P");
    expect(adj).toContain("A-Q");
  });

  it("center cell H-R has 4 neighbors", () => {
    const adj = getAdjacentCells(config, "H-R");
    expect(adj).toHaveLength(4);
    expect(adj).toContain("G-R");
    expect(adj).toContain("I-R");
    expect(adj).toContain("H-Q");
    expect(adj).toContain("H-S");
  });
});

describe("isAdjacentToRegion", () => {
  it("returns true when a neighbor is crossed", () => {
    expect(isAdjacentToRegion(config, "G-P", ["H-P"])).toBe(true);
  });

  it("returns false when no neighbor is crossed", () => {
    expect(isAdjacentToRegion(config, "A-P", ["H-P"])).toBe(false);
  });
});

describe("isValidPlacement", () => {
  it("allows startColumn cells when crossed is empty", () => {
    expect(isValidPlacement(config, "H-P", [])).toBe(true);
    expect(isValidPlacement(config, "H-V", [])).toBe(true);
  });

  it("rejects non-startColumn cells when crossed is empty", () => {
    expect(isValidPlacement(config, "A-P", [])).toBe(false);
    expect(isValidPlacement(config, "G-P", [])).toBe(false);
  });

  it("allows adjacent cells when region exists", () => {
    expect(isValidPlacement(config, "G-P", ["H-P"])).toBe(true);
  });

  it("rejects non-adjacent cells when region exists", () => {
    expect(isValidPlacement(config, "A-P", ["H-P"])).toBe(false);
  });

  it("allows startColumn cells even when not adjacent to existing region", () => {
    // H-V is not adjacent to H-P (they are far apart), but column H is always valid
    expect(isValidPlacement(config, "H-V", ["H-P"])).toBe(true);
  });
});

describe("isColumnComplete", () => {
  it("returns false when column is not fully crossed", () => {
    expect(isColumnComplete(config, "H", ["H-P", "H-Q"])).toBe(false);
  });

  it("returns true when all cells in column are crossed", () => {
    const hCells = ["H-P", "H-Q", "H-R", "H-S", "H-T", "H-U", "H-V"];
    expect(isColumnComplete(config, "H", hCells)).toBe(true);
  });
});

describe("isRowComplete", () => {
  it("returns false when row is not fully crossed", () => {
    const partial = ["A-P", "B-P", "C-P"];
    expect(isRowComplete(config, "P", partial)).toBe(false);
  });

  it("returns true when all cells in row P are crossed", () => {
    const rowP = config.grid.columns
      .map((col) => `${col}-P`)
      .filter((key) => key in config.cells);
    expect(isRowComplete(config, "P", rowP)).toBe(true);
  });
});

describe("isColorComplete", () => {
  it("returns false when color has uncrossed cells", () => {
    expect(isColorComplete(config, "g", ["H-P"])).toBe(false);
  });

  it("returns true when every cell of the color is crossed", () => {
    const greenCells = getCellsOfColor(config, "g");
    expect(isColorComplete(config, "g", greenCells)).toBe(true);
  });
});

describe("getConnectedRegion", () => {
  it("returns single cell when no same-color neighbors", () => {
    // H-P is green; its neighbors G-P (pink), I-P (green) — actually I-P is green
    // Let's use a cell where color neighbors are all crossed
    // G-P is pink; F-P (pink), H-P (green, different color), G-Q (pink)
    // With H-P crossed and F-P crossed, G-P still connects to G-Q
    const region = getConnectedRegion(config, "p", "G-P", ["F-P"]);
    // G-P → G-Q (pink) → ...
    expect(region).toContain("G-P");
    expect(region).toContain("G-Q");
    expect(region).not.toContain("F-P"); // already crossed
  });

  it("returns the full connected orange region from H-R", () => {
    const region = getConnectedRegion(config, "o", "H-R", []);
    expect(new Set(region)).toEqual(
      new Set(["H-R", "G-R", "F-R", "F-Q", "E-Q"]),
    );
  });

  it("returns empty array when start cell is already crossed", () => {
    const region = getConnectedRegion(config, "o", "H-R", ["H-R"]);
    expect(region).toHaveLength(0);
  });

  it("stops at already-crossed cells", () => {
    // Cross G-R, splitting the orange region
    const region = getConnectedRegion(config, "o", "H-R", ["G-R"]);
    expect(region).toContain("H-R");
    expect(region).not.toContain("G-R");
    expect(region).not.toContain("F-R");
    expect(region).not.toContain("F-Q");
    expect(region).not.toContain("E-Q");
  });
});

describe("colorsCompleted", () => {
  it("returns empty array when no colors are complete", () => {
    expect(colorsCompleted(config, [])).toHaveLength(0);
  });

  it("returns a color when all its cells are crossed", () => {
    const greenCells = getCellsOfColor(config, "g");
    expect(colorsCompleted(config, greenCells)).toContain("g");
  });
});

describe("uncrossedStars", () => {
  it("returns all 12 star cells when nothing is crossed", () => {
    expect(uncrossedStars(config, [])).toHaveLength(12);
  });

  it("excludes crossed star cells", () => {
    expect(uncrossedStars(config, ["H-R"])).toHaveLength(11);
    expect(uncrossedStars(config, ["H-R"])).not.toContain("H-R");
  });
});
