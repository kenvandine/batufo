import { Levels } from './levels'
import { TilePosition } from './tile-position'
import { Tile, Tilemap } from './tilemap'

export class Arena {
  constructor(
    readonly floorTiles: TilePosition[],
    readonly walls: TilePosition[],
    readonly players: TilePosition[],
    readonly nrows: number,
    readonly ncols: number
  ) {}

  isFull(registeredPlayers: number) {
    return this.players.length == registeredPlayers
  }

  static fromTilemap(tilemap: Tilemap, tileSize: number) {
    const nrows = tilemap.nrows
    const ncols = tilemap.ncols
    const center = tileSize / 2
    const floorTiles: TilePosition[] = []
    const walls: TilePosition[] = []
    const initialPlayers: TilePosition[] = []

    for (let row = 0; row < nrows; row++) {
      for (let col = 0; col < ncols; col++) {
        const tile = tilemap.tiles[row * ncols + col]
        if (!Tilemap.coversBackground(tile)) {
          floorTiles.push(new TilePosition(col, row, center, center))
        }
        if (tile === Tile.Wall || tile === Tile.Boundary) {
          walls.push(new TilePosition(col, row, center, center))
        }
        if (tile === Tile.Player) {
          initialPlayers.push(new TilePosition(col, row, center, center))
        }
      }
    }
    return new Arena(floorTiles, walls, initialPlayers, nrows, ncols)
  }

  static forLevel(levelName: string, tileSize: number): Arena {
    const tilemap = Levels.tilemapForLevel(levelName)
    return Arena.fromTilemap(tilemap, tileSize)
  }
}