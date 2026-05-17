import type {
  BoardConfig,
  BoardCell,
  CellKey,
  Color,
} from "@/boards/board.types";

export function getCell(
  config: BoardConfig,
  key: CellKey,
): BoardCell | undefined {
  return config.cells[key];
}

export function getCellsOfColor(config: BoardConfig, color: Color): CellKey[] {
  return Object.entries(config.cells)
    .filter(([, cell]) => cell.color === color)
    .map(([key]) => key);
}

export function isColumnComplete(
  config: BoardConfig,
  col: string,
  crossed: string[],
): boolean {
  const crossedSet = new Set(crossed);
  return config.grid.rows.every((row) => {
    const key = `${col}-${row}`;
    return !(key in config.cells) || crossedSet.has(key);
  });
}

export function isRowComplete(
  config: BoardConfig,
  row: string,
  crossed: string[],
): boolean {
  const crossedSet = new Set(crossed);
  return config.grid.columns.every((col) => {
    const key = `${col}-${row}`;
    return !(key in config.cells) || crossedSet.has(key);
  });
}

export function isColorComplete(
  config: BoardConfig,
  color: Color,
  crossed: string[],
): boolean {
  const crossedSet = new Set(crossed);
  return getCellsOfColor(config, color).every((key) => crossedSet.has(key));
}

export function getAdjacentCells(config: BoardConfig, key: CellKey): CellKey[] {
  const [col, row] = key.split("-");
  const colIdx = config.grid.columns.indexOf(col);
  const rowIdx = config.grid.rows.indexOf(row);
  const neighbors: CellKey[] = [];
  const directions = [
    [colIdx - 1, rowIdx],
    [colIdx + 1, rowIdx],
    [colIdx, rowIdx - 1],
    [colIdx, rowIdx + 1],
  ];
  for (const [c, r] of directions) {
    if (
      c < 0 ||
      r < 0 ||
      c >= config.grid.columns.length ||
      r >= config.grid.rows.length
    )
      continue;
    const neighborKey = `${config.grid.columns[c]}-${config.grid.rows[r]}`;
    if (neighborKey in config.cells) neighbors.push(neighborKey);
  }
  return neighbors;
}

export function isAdjacentToRegion(
  config: BoardConfig,
  key: CellKey,
  crossed: string[],
): boolean {
  const crossedSet = new Set(crossed);
  return getAdjacentCells(config, key).some((k) => crossedSet.has(k));
}

// Returns true if the cell is in a start column or orthogonally adjacent to one.
// Used by the fill special die — a region may start from any cell touching column H.
export function isAdjacentToStartZone(
  config: BoardConfig,
  key: CellKey,
): boolean {
  const [col] = key.split("-");
  if (config.grid.startColumns.includes(col)) return true;
  return getAdjacentCells(config, key).some((adjKey) =>
    config.grid.startColumns.includes(adjKey.split("-")[0]),
  );
}

// Returns true if the cell is a valid placement target.
// startColumns (column H) are always valid regardless of the existing region.
// All other cells require orthogonal adjacency to the existing crossed region.
export function isValidPlacement(
  config: BoardConfig,
  key: CellKey,
  crossed: string[],
): boolean {
  const [col] = key.split("-");
  if (config.grid.startColumns.includes(col)) {
    return true;
  }
  if (crossed.length === 0) {
    return false;
  }
  return isAdjacentToRegion(config, key, crossed);
}

function bfsFromKey(
  start: CellKey,
  config: BoardConfig,
  shouldVisit: (key: CellKey) => boolean,
): Set<CellKey> {
  const visited = new Set<CellKey>([start]);
  const queue: CellKey[] = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of getAdjacentCells(config, current)) {
      if (visited.has(neighbor)) continue;
      if (shouldVisit(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

// BFS flood-fill: all cells of `color` reachable from `startKey` that are NOT already crossed.
export function getConnectedRegion(
  config: BoardConfig,
  color: Color,
  startKey: CellKey,
  crossed: string[],
): CellKey[] {
  const crossedSet = new Set(crossed);
  const startCell = config.cells[startKey];
  if (!startCell || startCell.color !== color || crossedSet.has(startKey))
    return [];

  return Array.from(
    bfsFromKey(startKey, config, (key) => {
      if (crossedSet.has(key)) return false;
      const cell = config.cells[key];
      return !!cell && cell.color === color;
    }),
  );
}

// Check if a set of cells form a single contiguous group (connected component).
// Only considers adjacency within the provided cells, not the full board.
export function areCellsContiguous(config: BoardConfig, cells: CellKey[]): boolean {
  if (cells.length <= 1) return true;
  const cellSet = new Set(cells);
  const visited = bfsFromKey(cells[0], config, (key) => cellSet.has(key));
  return visited.size === cells.length;
}

// Like areCellsContiguous, but allows same-color already-crossed cells to act as
// bridges. This lets a player pick e.g. [A] and [C] in one turn when [B] (same color)
// is already crossed — they're connected through B even though A and C aren't adjacent.
export function areCellsContiguousWithBridge(
  config: BoardConfig,
  cells: CellKey[],
  crossed: string[],
): boolean {
  if (cells.length <= 1) return true;
  const targetSet = new Set(cells);
  const crossedSet = new Set(crossed);
  const color = config.cells[cells[0]]?.color;
  if (!color) return false;

  const visited = bfsFromKey(cells[0], config, (key) => {
    return targetSet.has(key) || (crossedSet.has(key) && config.cells[key]?.color === color);
  });
  return cells.every((k) => visited.has(k));
}

export function getBoardColors(config: BoardConfig): Color[] {
  return [...new Set(Object.values(config.cells).map((c) => c.color))];
}

export function colorsCompleted(
  config: BoardConfig,
  crossed: string[],
): Color[] {
  return getBoardColors(config).filter((color) =>
    isColorComplete(config, color, crossed),
  );
}

export function uncrossedStars(
  config: BoardConfig,
  crossed: string[],
): CellKey[] {
  const crossedSet = new Set(crossed);
  return Object.entries(config.cells)
    .filter(([key, cell]) => cell.special === "star" && !crossedSet.has(key))
    .map(([key]) => key);
}
