import type { BoardConfig, BoardCell, Color, CellKey } from "@/boards/board.types";
import standardBoard from "@/boards/kok2-standard.json";
import { mulberry32, fisherYatesShuffle } from "@/lib/game/prng";

const COLUMNS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O"] as const;
const ROWS = ["P","Q","R","S","T","U","V"] as const;
const COLORS: Color[] = ["p","o","y","g","b"];

const STAR_COUNT = 12;
const BOX_COUNT = 5;
const TARGET_PER_COLOR = 21; // 105 / 5
const MAX_COMPONENT_SIZE = 6;

const EDGE_COLS = new Set(["A","B","C","D","L","M","N","O"]);

type Coord = { col: number; row: number; key: CellKey };

function buildAllCells(): Coord[] {
  const cells: Coord[] = [];
  for (let c = 0; c < COLUMNS.length; c++)
    for (let r = 0; r < ROWS.length; r++)
      cells.push({ col: c, row: r, key: `${COLUMNS[c]}-${ROWS[r]}` });
  return cells;
}

function buildCoordMap(allCells: Coord[]): Map<CellKey, Coord> {
  return new Map(allCells.map(c => [c.key, c]));
}

function neighborKeys(coord: Coord): CellKey[] {
  const { col: c, row: r } = coord;
  const keys: CellKey[] = [];
  if (c > 0) keys.push(`${COLUMNS[c - 1]}-${ROWS[r]}`);
  if (c < COLUMNS.length - 1) keys.push(`${COLUMNS[c + 1]}-${ROWS[r]}`);
  if (r > 0) keys.push(`${COLUMNS[c]}-${ROWS[r - 1]}`);
  if (r < ROWS.length - 1) keys.push(`${COLUMNS[c]}-${ROWS[r + 1]}`);
  return keys;
}

function findComponents(
  assignment: Record<CellKey, Color>,
  color: Color,
  coordMap: Map<CellKey, Coord>,
): CellKey[][] {
  const colorKeys = Object.keys(assignment).filter(k => assignment[k] === color);
  const visited = new Set<CellKey>();
  const components: CellKey[][] = [];

  for (const start of colorKeys) {
    if (visited.has(start)) continue;
    const component: CellKey[] = [];
    const stack: CellKey[] = [start];
    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      component.push(curr);
      for (const nb of neighborKeys(coordMap.get(curr)!)) {
        if (!visited.has(nb) && assignment[nb] === color) stack.push(nb);
      }
    }
    components.push(component);
  }
  return components;
}

// Returns true if assigning `key` to `newColor` would create a component larger than MAX_COMPONENT_SIZE.
function wouldOverflow(
  key: CellKey,
  newColor: Color,
  assignment: Record<CellKey, Color>,
  coordMap: Map<CellKey, Coord>,
): boolean {
  const visited = new Set<CellKey>();
  visited.add(key);
  const queue: CellKey[] = neighborKeys(coordMap.get(key)!).filter(
    nb => assignment[nb] === newColor,
  );
  let count = 1;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    count++;
    if (count > MAX_COMPONENT_SIZE) return true;
    for (const nb of neighborKeys(coordMap.get(curr)!)) {
      if (!visited.has(nb) && assignment[nb] === newColor) queue.push(nb);
    }
  }
  return false;
}

function countColors(assignment: Record<CellKey, Color>): Record<Color, number> {
  const counts: Record<Color, number> = { p: 0, o: 0, y: 0, g: 0, b: 0 };
  for (const color of Object.values(assignment)) counts[color]++;
  return counts;
}

function assignColors(allCells: Coord[], rand: () => number): Record<CellKey, Color> {
  // 5 seeds per color across 5 bands of 3 columns (A-C, D-F, G-I, J-L, M-O).
  const BANDS = 5;
  const BAND_SIZE = 3;
  const JITTER_AMP = 1.5;

  type Seed = { color: Color; col: number; row: number };
  const seeds: Seed[] = [];
  for (const color of COLORS) {
    for (let band = 0; band < BANDS; band++) {
      const bandStart = band * BAND_SIZE;
      seeds.push({
        color,
        col: bandStart + Math.floor(rand() * BAND_SIZE),
        row: Math.floor(rand() * ROWS.length),
      });
    }
  }

  const jitter = seeds.map(() => ({
    dx: (rand() * 2 - 1) * JITTER_AMP,
    dy: (rand() * 2 - 1) * JITTER_AMP,
  }));

  const assignment: Record<CellKey, Color> = {};
  for (const cell of allCells) {
    let minDist = Infinity;
    let color = COLORS[0];
    for (let i = 0; i < seeds.length; i++) {
      const dx = cell.col - (seeds[i].col + jitter[i].dx);
      const dy = cell.row - (seeds[i].row + jitter[i].dy);
      const dist = dx * dx + dy * dy;
      if (dist < minDist) { minDist = dist; color = seeds[i].color; }
    }
    assignment[cell.key] = color;
  }
  return assignment;
}

// Rough first-pass rebalance — does not check component sizes, just balances counts.
function rebalanceColors(
  assignment: Record<CellKey, Color>,
  allCells: Coord[],
  coordMap: Map<CellKey, Coord>,
  rand: () => number,
): void {
  const shuffled = fisherYatesShuffle([...allCells], rand);

  for (let iter = 0; iter < 300; iter++) {
    const counts = countColors(assignment);
    if (COLORS.every(c => counts[c] >= 19 && counts[c] <= 23)) break;

    let changed = false;
    for (const cell of shuffled) {
      const cellColor = assignment[cell.key];
      if (counts[cellColor] <= TARGET_PER_COLOR) continue;

      for (const nbKey of neighborKeys(coordMap.get(cell.key)!)) {
        const nbColor = assignment[nbKey];
        if (counts[nbColor] < TARGET_PER_COLOR) {
          counts[cellColor]--;
          counts[nbColor]++;
          assignment[cell.key] = nbColor;
          changed = true;
          break;
        }
      }
    }

    if (!changed) break;
  }
}

// Break any contiguous same-color region that exceeds MAX_COMPONENT_SIZE.
// Boundary cells are reassigned to a neighboring color.
function breakLargeComponents(
  assignment: Record<CellKey, Color>,
  coordMap: Map<CellKey, Coord>,
  rand: () => number,
): void {
  let changed = true;
  let iters = 0;

  while (changed && iters++ < 500) {
    changed = false;

    for (const color of COLORS) {
      for (const component of findComponents(assignment, color, coordMap)) {
        if (component.length <= MAX_COMPONENT_SIZE) continue;

        const boundary = component.filter(key =>
          neighborKeys(coordMap.get(key)!).some(nb => assignment[nb] !== color),
        );

        const shuffled = fisherYatesShuffle([...boundary], rand);
        let excess = component.length - MAX_COMPONENT_SIZE;

        for (const key of shuffled) {
          if (excess <= 0) break;
          const adjColors = neighborKeys(coordMap.get(key)!)
            .filter(nb => assignment[nb] !== color)
            .map(nb => assignment[nb]);
          if (adjColors.length === 0) continue;
          assignment[key] = adjColors[Math.floor(rand() * adjColors.length)];
          excess--;
          changed = true;
        }
      }
    }
  }
}

// Second-pass rebalance: restores count balance after breakLargeComponents,
// but only accepts swaps that will NOT create a new oversized component.
function smartRebalance(
  assignment: Record<CellKey, Color>,
  allCells: Coord[],
  coordMap: Map<CellKey, Coord>,
  rand: () => number,
): void {
  const shuffled = fisherYatesShuffle([...allCells], rand);

  for (let iter = 0; iter < 400; iter++) {
    const counts = countColors(assignment);
    if (COLORS.every(c => counts[c] >= 19 && counts[c] <= 23)) break;

    let changed = false;
    for (const cell of shuffled) {
      const cellColor = assignment[cell.key];
      if (counts[cellColor] <= TARGET_PER_COLOR) continue;

      for (const nbKey of neighborKeys(coordMap.get(cell.key)!)) {
        const nbColor = assignment[nbKey];
        if (counts[nbColor] >= TARGET_PER_COLOR) continue;
        if (wouldOverflow(cell.key, nbColor, assignment, coordMap)) continue;

        counts[cellColor]--;
        counts[nbColor]++;
        assignment[cell.key] = nbColor;
        changed = true;
        break;
      }
    }

    if (!changed) break;
  }
}

function placeStars(allCells: CellKey[], rand: () => number): Set<CellKey> {
  const pool: CellKey[] = [];
  for (const key of allCells) {
    const col = key.split("-")[0];
    const weight = EDGE_COLS.has(col) ? 2 : 1;
    for (let w = 0; w < weight; w++) pool.push(key);
  }
  const shuffled = fisherYatesShuffle(pool, rand);
  const stars = new Set<CellKey>();
  for (const key of shuffled) {
    if (!stars.has(key)) stars.add(key);
    if (stars.size === STAR_COUNT) break;
  }
  return stars;
}

function placeBoxes(allCells: CellKey[], starCells: Set<CellKey>, rand: () => number): Set<CellKey> {
  const candidates = allCells.filter(k => !starCells.has(k));
  const shuffled = fisherYatesShuffle(candidates, rand);
  return new Set(shuffled.slice(0, BOX_COUNT));
}

function validate(
  cells: Record<CellKey, BoardCell>,
  coordMap: Map<CellKey, Coord>,
): boolean {
  if (Object.keys(cells).length !== 105) return false;

  const counts: Record<Color, number> = { p: 0, o: 0, y: 0, g: 0, b: 0 };
  let stars = 0;
  let boxes = 0;

  for (const [, cell] of Object.entries(cells)) {
    counts[cell.color]++;
    if (cell.special === "star") stars++;
    if (cell.special === "box") boxes++;
  }

  for (const color of COLORS) {
    if (counts[color] < 19 || counts[color] > 23) return false;
  }
  if (stars !== STAR_COUNT || boxes !== BOX_COUNT) return false;

  const assignment: Record<CellKey, Color> = {};
  for (const [k, cell] of Object.entries(cells)) assignment[k] = cell.color;

  for (const color of COLORS) {
    for (const component of findComponents(assignment, color, coordMap)) {
      if (component.length > MAX_COMPONENT_SIZE) return false;
    }
  }

  return true;
}

export function generateBoard(seed: number): BoardConfig {
  const allCells = buildAllCells();
  const allKeys = allCells.map(c => c.key);
  const coordMap = buildCoordMap(allCells);
  const sb = standardBoard as unknown as BoardConfig;

  for (let attempt = 0; attempt < 10; attempt++) {
    const rand = mulberry32((seed ^ (attempt * 0x9e3779b9)) >>> 0);

    const colorAssignment = assignColors(allCells, rand);
    // Phase 1: fast rebalance to ~21 cells per color (may create large components)
    rebalanceColors(colorAssignment, allCells, coordMap, rand);
    // Phase 2: break components > MAX_COMPONENT_SIZE (may slightly unbalance counts)
    breakLargeComponents(colorAssignment, coordMap, rand);
    // Phase 3: restore count balance only via swaps that don't recreate large components
    smartRebalance(colorAssignment, allCells, coordMap, rand);

    const starCells = placeStars(allKeys, rand);
    const boxCells = placeBoxes(allKeys, starCells, rand);

    const cells: Record<CellKey, BoardCell> = {};
    for (const { key } of allCells) {
      const cell: BoardCell = { color: colorAssignment[key] };
      if (starCells.has(key)) cell.special = "star";
      else if (boxCells.has(key)) cell.special = "box";
      cells[key] = cell;
    }

    if (!validate(cells, coordMap)) continue;

    return {
      id: `kok2-generated-${seed}`,
      name: `Generated Board #${seed}`,
      version: 1,
      grid: {
        columns: [...sb.grid.columns],
        rows: [...sb.grid.rows],
        startColumns: [...sb.grid.startColumns],
      },
      scoring: sb.scoring,
      cells,
    };
  }

  throw new Error(`generateBoard: failed for seed ${seed} after 10 attempts`);
}
