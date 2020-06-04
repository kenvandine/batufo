import { Server } from 'socket.io'
import { ServerGame } from '../server-game'
import { PlayerDeparted, PlayerJoined } from '../generated/message_bus_pb'

import socketio from 'socket.io'
import debug from 'debug'
const logDebug = debug('game-socket:debug')
const logError = debug('game-socket:error')
const logTrace = debug('game-socket:trace')

const LEAVE_AFTER_INCOMMUNICADO = 15e3
const CHECK_INCOMMUNICADOS_INTERVAL = 5e3

function getJoiningPlayer(clientID: number, playerIndex: number) {
  const joiningPlayer = new PlayerJoined()
  joiningPlayer.setClientid(clientID)
  joiningPlayer.setPlayerindex(playerIndex)
  return joiningPlayer
}

class GameSocket {
  private readonly _gameID: string
  private readonly _incommunicadosTimeout: NodeJS.Timeout
  constructor(
    readonly io: Server,
    readonly game: ServerGame,
    readonly leaveAfterIncommunicado = LEAVE_AFTER_INCOMMUNICADO,
    checkIncommunicadosInterval = CHECK_INCOMMUNICADOS_INTERVAL
  ) {
    this._gameID = `${game.gameID}`
    this._incommunicadosTimeout = setInterval(
      this._departIncommunicados,
      checkIncommunicadosInterval
    )
  }

  addSocket(socket: socketio.Socket, clientID: number, playerIndex: number) {
    this._tellClientsPlayerJoined(clientID, playerIndex)
    this.game.clientCommunicated(clientID)

    const onGameClientUpdate = (data: Buffer) => {
      logTrace('got playing client message -> broadcasting')
      this.game.clientCommunicated(clientID)
      try {
        const array = Uint8Array.from(data)
        socket.broadcast
          .to(this._gameID)
          .emit('game:client-update', array.toString())
      } catch (err) {
        logError('game:client-update', err)
      }
    }

    const onGameSpawnedBullet = (data: Buffer) => {
      logTrace('got spawned bullet message -> broadcasting')
      this.game.clientCommunicated(clientID)
      try {
        const array = Uint8Array.from(data)
        socket.broadcast
          .to(this._gameID)
          .emit('game:spawned-bullet', array.toString())
      } catch (err) {
        logError('game:spawned-bullet', err)
      } finally {
      }
    }

    const onGameLeave = (_data: Buffer) => {
      logDebug('client [%d] is leaving', clientID)
      disposeSocketHandlers()
      this.game.departClient(clientID)
      const playerDeparted = new PlayerDeparted()
      playerDeparted.setClientid(clientID)
      socket.broadcast
        .to(this._gameID)
        .emit(
          'game:player-departed',
          playerDeparted.serializeBinary().toString()
        )
    }

    const onClientPing = (_data: Buffer) => {
      logTrace('client [%d] ', clientID)
      this.game.clientCommunicated(clientID)
    }

    const onJoined = (err: Error) => {
      if (err) logError(err)
      this._tellPlayerAboutPreviousJoins(socket)
      this._tellClientsIfGameIsReady()
    }

    const disposeSocketHandlers = () => {
      logDebug('disposing socket handlers')
      socket
        .leave(this._gameID)
        .off('game:client-update', onGameClientUpdate)
        .off('game:spawned-bullet', onGameSpawnedBullet)
        .off('game:leave', onGameLeave)
        .off('client:ping', onClientPing)
    }

    socket
      .on('game:client-update', onGameClientUpdate)
      .on('game:spawned-bullet', onGameSpawnedBullet)
      .on('game:leave', onGameLeave)
      .on('client:ping', onClientPing)
      .join(this._gameID, onJoined)
  }

  _tellClientsPlayerJoined(clientID: number, playerIndex: number) {
    try {
      logDebug('client [%d] is joining at index [%d]', clientID, playerIndex)
      const playerJoined = getJoiningPlayer(clientID, playerIndex)
      this.io.sockets
        .in(this._gameID)
        .emit('game:player-joined', playerJoined.serializeBinary().toString())
    } catch (err) {
      logError('game:player-joined', err)
    }
  }

  _tellPlayerAboutPreviousJoins(socket: socketio.Socket) {
    for (const [clientID, playerIndex] of this.game.playerIndexes) {
      const joinedPlayer = getJoiningPlayer(clientID, playerIndex)
      try {
        socket.emit(
          'game:player-joined',
          joinedPlayer.serializeBinary().toString()
        )
      } catch (err) {
        logError('game:player-joined (multi)', err)
      }
    }
  }

  _tellClientsIfGameIsReady() {
    logTrace(
      `game has ${this.game.clientIDs.size}/${this.game.nplayers} players`
    )
    if (!this.game.full) return
    logDebug('game is full, sending game:started')
    try {
      this.io.sockets.in(this._gameID).emit('game:started')
    } catch (err) {
      logError('game:started', err)
    }
  }

  _departIncommunicados = () => {
    const now = Date.now()
    for (const clientID of this.game.clientIDs) {
      if (
        now - this.game.lastClientCommunication(clientID) >
        this.leaveAfterIncommunicado
      ) {
        this._departIncommunicado(clientID)
      }
    }
  }

  _departIncommunicado(clientID: number) {
    logDebug(`departing incommunicado ${clientID}`)
    try {
      this.game.departClient(clientID)
      const playerDeparted = new PlayerDeparted()
      playerDeparted.setClientid(clientID)
      this.io.sockets
        .in(this._gameID)
        .emit(
          'game:player-departed',
          playerDeparted.serializeBinary().toString()
        )
    } catch (err) {
      logError('game:started', err)
    }
  }

  dispose() {
    clearInterval(this._incommunicadosTimeout)
  }
}

export class GameSockets {
  readonly gameSockets: Map<number, GameSocket> = new Map()

  addSocketFor(
    io: Server,
    socket: socketio.Socket,
    game: ServerGame,
    clientID: number,
    playerIndex: number
  ) {
    let gameSocket
    gameSocket = this.gameSockets.get(game.gameID)

    if (gameSocket == null) {
      gameSocket = new GameSocket(io, game)
      this.gameSockets.set(game.gameID, gameSocket)

      game.once('disposed', (gameID) => {
        logDebug('removing socket for %d', gameID)
        this.gameSockets.get(gameID)?.dispose()
        this.gameSockets.delete(gameID)
      })
    }

    gameSocket.addSocket(socket, clientID, playerIndex)
  }
}
