import { strict as assert } from 'assert'
import { UnreachableCaseError } from '../types'

export enum Tile {
  /* 0 */ OutOfBounds,
  /* 1 */ Empty,
  /* 2 */ Hole,
  /* 3 */ Wall,
  /* 4 */ Player,
  /* 5 */ Medkit,
  /* 6 */ Shield,
  /* 7 */ Bomb,
}

export const EMPTY = ' '

export const TileKeys = [EMPTY, 'x', 'p', '=', '+', 's', 'b'] as const
export type TileKey = typeof TileKeys[number]

const charToTile: Map<TileKey, Tile> = new Map([
  [EMPTY, Tile.Empty],
  ['x', Tile.Hole],
  ['p', Tile.Player],
  ['=', Tile.Wall],
  ['+', Tile.Medkit],
  ['s', Tile.Shield],
  ['b', Tile.Bomb],
])

function tileFromChar(char: TileKey) {
  const tile = charToTile.get(char)
  assert(tile != null, '$char needs to be in charToTile map')
  return tile
}

function isTileKey(s: string): s is TileKey {
  return TileKeys.includes(s as TileKey)
}

function getBounds(row: string) {
  let start = Math.max(row.indexOf('='), 0)
  let end = row.lastIndexOf('=')
  if (end === start) end = row.length - 1
  return [start, end]
}

export class Tilemap {
  constructor(
    readonly tiles: Tile[],
    readonly nrows: number,
    readonly ncols: number
  ) {}

  static build(terrain: string): Tilemap {
    const allLines = terrain.split('\n')
    // remove leading and trailing empty lines
    let start = 0
    for (; start < allLines.length; start++) {
      if (allLines[start].trim().length > 0) break
    }
    let end = allLines.length - 1
    for (; end > start; end--) {
      if (allLines[end].trim().length > 0) break
    }

    const lines: string[] = allLines.slice(start, end + 1)

    const nrows = lines.length
    let ncols = 0
    for (const line of lines) {
      ncols = Math.max(line.length, ncols)
    }

    const ntiles = nrows * ncols
    const tiles: Tile[] = new Array(ntiles).fill(Tile.OutOfBounds)

    for (let row = 0; row < nrows; row++) {
      const line = lines[row]
      const [start, end] = getBounds(line)
      // Our tilemap has 0,0 at the left bottom corner
      const tileRow = nrows - row - 1
      for (let col = start; col <= end; col++) {
        const char = line[col]
        assert(isTileKey(char), `unknown tile key ${char}`)
        const idx = tileRow * ncols + col
        assert(idx < tiles.length)
        tiles[idx] = tileFromChar(char)
      }
    }

    return new Tilemap(tiles, nrows, ncols)
  }

  static needsFloorTile(tile: Tile): boolean {
    switch (tile) {
      case Tile.OutOfBounds:
      case Tile.Wall:
      case Tile.Hole:
        return false
      case Tile.Empty:
      case Tile.Player:
      case Tile.Shield:
      case Tile.Medkit:
      case Tile.Bomb:
        return true
      default:
        throw new UnreachableCaseError(tile)
    }
  }

  get _tilesString(): string {
    assert(
      this.tiles.length == this.nrows * this.ncols,
      'incorrectly sized tiles'
    )
    let s = ''
    for (let row = this.nrows - 1; row >= 0; row--) {
      s += '  ( '
      for (let col = 0; col < this.ncols; col++) {
        const tile = this.tiles[row * this.ncols + col]
        const char =
          tile == Tile.OutOfBounds ? 'X' : tile == Tile.Empty ? ' ' : tile
        s += `${char} `
      }
      s += row == 0 ? ')' : ')\n'
    }
    return s
  }

  toString(): string {
    return `Tilemap (${this.ncols} x ${this.nrows})
  ----------------------
${this._tilesString}
  ----------------------
`
  }
}

/* Testing Area
const terrain: string = `
=======================
=         p           =
=                     =
=====           p     =
    =     ====        =
    =   d =  =        =
    =     ====        =
=====                 ====
=   +   p       p        =
=                     ====
=======================
`

const tilemap = Tilemap.build(terrain)
console.log(tilemap.toString())
*/
