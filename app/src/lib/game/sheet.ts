import type { BoardConfig, BoardCell, CellKey, Color } from '@/boards/board.types'

export function getCell(config: BoardConfig, key: CellKey): BoardCell | undefined {
  return config.cells[key]
}

export function getCellsOfColor(config: BoardConfig, color: Color): CellKey[] {
  return Object.entries(config.cells)
    .filter(([, cell]) => cell.color === color)
    .map(([key]) => key)
}

export function isColumnComplete(config: BoardConfig, col: string, crossed: string[]): boolean {
  const crossedSet = new Set(crossed)
  return config.grid.rows.every(row => {
    const key = `${col}-${row}`
    return !(key in config.cells) || crossedSet.has(key)
  })
}

export function isRowComplete(config: BoardConfig, row: string, crossed: string[]): boolean {
  const crossedSet = new Set(crossed)
  return config.grid.columns.every(col => {
    const key = `${col}-${row}`
    return !(key in config.cells) || crossedSet.has(key)
  })
}

export function isColorComplete(config: BoardConfig, color: Color, crossed: string[]): boolean {
  const crossedSet = new Set(crossed)
  return getCellsOfColor(config, color).every(key => crossedSet.has(key))
}

export function getAdjacentCells(config: BoardConfig, key: CellKey): CellKey[] {
  const [col, row] = key.split('-')
  const colIdx = config.grid.columns.indexOf(col)
  const rowIdx = config.grid.rows.indexOf(row)
  const neighbors: CellKey[] = []
  const directions = [
    [colIdx - 1, rowIdx],
    [colIdx + 1, rowIdx],
    [colIdx, rowIdx - 1],
    [colIdx, rowIdx + 1],
  ]
  for (const [c, r] of directions) {
    if (c < 0 || r < 0 || c >= config.grid.columns.length || r >= config.grid.rows.length) continue
    const neighborKey = `${config.grid.columns[c]}-${config.grid.rows[r]}`
    if (neighborKey in config.cells) neighbors.push(neighborKey)
  }
  return neighbors
}

export function isAdjacentToRegion(config: BoardConfig, key: CellKey, crossed: string[]): boolean {
  const crossedSet = new Set(crossed)
  return getAdjacentCells(config, key).some(k => crossedSet.has(k))
}

// Returns true if the cell is a valid placement target.
// When the crossed region is empty, cells in startColumns are valid starting points.
export function isValidPlacement(config: BoardConfig, key: CellKey, crossed: string[]): boolean {
  if (crossed.length === 0) {
    const [col] = key.split('-')
    return config.grid.startColumns.includes(col)
  }
  return isAdjacentToRegion(config, key, crossed)
}

// BFS flood-fill: all cells of `color` reachable from `startKey` that are NOT already crossed.
export function getConnectedRegion(
  config: BoardConfig,
  color: Color,
  startKey: CellKey,
  crossed: string[]
): CellKey[] {
  const crossedSet = new Set(crossed)
  const startCell = config.cells[startKey]
  if (!startCell || startCell.color !== color || crossedSet.has(startKey)) return []

  const visited = new Set<CellKey>()
  const queue: CellKey[] = [startKey]
  visited.add(startKey)

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const neighbor of getAdjacentCells(config, current)) {
      if (visited.has(neighbor)) continue
      if (crossedSet.has(neighbor)) continue
      const cell = config.cells[neighbor]
      if (!cell || cell.color !== color) continue
      visited.add(neighbor)
      queue.push(neighbor)
    }
  }

  return Array.from(visited)
}

export function colorsCompleted(config: BoardConfig, crossed: string[]): Color[] {
  const colors: Color[] = ['p', 'o', 'y', 'g', 'b']
  return colors.filter(color => isColorComplete(config, color, crossed))
}

export function uncrossedStars(config: BoardConfig, crossed: string[]): CellKey[] {
  const crossedSet = new Set(crossed)
  return Object.entries(config.cells)
    .filter(([key, cell]) => cell.special === 'star' && !crossedSet.has(key))
    .map(([key]) => key)
}
