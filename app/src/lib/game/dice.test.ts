import { describe, it, expect } from "vitest";
import {
  COLOR_FACES,
  NUMBER_FACES,
  SPECIAL_FACES,
  rollDice,
  isColorWildcard,
  isNumberWildcard,
} from "./dice";

describe("dice constants", () => {
  it("COLOR_FACES has 6 entries", () => {
    expect(COLOR_FACES).toHaveLength(6);
  });

  it("NUMBER_FACES has 6 entries", () => {
    expect(NUMBER_FACES).toHaveLength(6);
  });

  it("SPECIAL_FACES has 6 entries with heart appearing twice", () => {
    expect(SPECIAL_FACES).toHaveLength(6);
    expect(SPECIAL_FACES.filter((f) => f === "heart")).toHaveLength(2);
    expect(SPECIAL_FACES.filter((f) => f === "fill")).toHaveLength(1);
    expect(SPECIAL_FACES.filter((f) => f === "bomb")).toHaveLength(1);
    expect(SPECIAL_FACES.filter((f) => f === "two_stars")).toHaveLength(1);
    expect(SPECIAL_FACES.filter((f) => f === "three_in_a_row")).toHaveLength(1);
  });
});

describe("rollDice", () => {
  it("returns valid faces for all slots", () => {
    for (let i = 0; i < 100; i++) {
      const roll = rollDice();
      expect(roll.colors).toHaveLength(3);
      expect(roll.numbers).toHaveLength(3);
      for (const c of roll.colors) expect(COLOR_FACES).toContain(c);
      for (const n of roll.numbers) expect(NUMBER_FACES).toContain(n);
      expect(SPECIAL_FACES).toContain(roll.special);
    }
  });
});

describe("isColorWildcard", () => {
  it("returns true only for ✕", () => {
    expect(isColorWildcard("✕")).toBe(true);
    expect(isColorWildcard("p")).toBe(false);
    expect(isColorWildcard("o")).toBe(false);
  });
});

describe("isNumberWildcard", () => {
  it("returns true only for ?", () => {
    expect(isNumberWildcard("?")).toBe(true);
    expect(isNumberWildcard("1")).toBe(false);
    expect(isNumberWildcard("5")).toBe(false);
  });
});
