import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WebSocketService } from './websocket.service';
import { WebSocketMessage } from '../models/message.model';
import { ChessPiece } from '../models/chess-piece.model';
import { GameState } from '../models/game-state.model';
import { Player } from '../models/player.model';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private gameState = new BehaviorSubject<GameState | null>(null);
  private currentPlayer = new BehaviorSubject<Player | null>(null);
  private validMoves = new BehaviorSubject<{row: number, col: number}[]>([]);
  private selectedPieceSubject = new BehaviorSubject<{ row: number; col: number; piece: ChessPiece } | null>(null);
  
  public gameState$ = this.gameState.asObservable();
  public currentPlayer$ = this.currentPlayer.asObservable();
  public validMoves$ = this.validMoves.asObservable();
  public selectedPiece$ = this.selectedPieceSubject.asObservable();
  
  constructor(private wsService: WebSocketService) {
    this.wsService.messages$.subscribe(message => {
      this.handleIncomingMessage(message);
    });
  }
  
  joinGame(playerName: string, gameId: string = 'default-game'): void {
    this.wsService.send({
      type: 'join',
      payload: { playerName, gameId }
    });
  }
  
  selectPiece(row: number, col: number, piece: ChessPiece | null): void {
    if (!piece) {
      this.selectedPieceSubject.next(null);
      this.validMoves.next([]);
      return;
    }
    
    const currentPlayer = this.currentPlayer.value;
    const game = this.gameState.value;
    
    if (!currentPlayer || !game || piece.color !== currentPlayer.color || piece.color !== game.currentTurn) {
      console.log("Can't select this piece - not your turn or not your piece");
      return;
    }
    
    const selectedPiece = { row, col, piece };
    this.selectedPieceSubject.next(selectedPiece);
    this.validMoves.next([]); // Clear previous valid moves
    
    // Request valid moves from server
    this.wsService.send({
      type: 'getValidMoves',
      playerId: currentPlayer.id,
      payload: {
        gameId: game.id,
        row,
        col
      }
    });
    
    console.log(`Selected ${piece.color} ${piece.type} at ${row},${col}`);
  }
  
  movePiece(toRow: number, toCol: number, promotion?: 'queen' | 'rook' | 'bishop' | 'knight'): boolean {
    const selectedPiece = this.selectedPieceSubject.value;
    
    if (!selectedPiece) {
      console.log('No piece selected');
      return false;
    }
    
    const { row: fromRow, col: fromCol, piece } = selectedPiece;
    const game = this.gameState.value;
    const currentPlayer = this.currentPlayer.value;
    
    if (!game || !currentPlayer) {
      console.log('No game or player');
      return false;
    }
    
    // Check if this is a valid move
    const currentValidMoves = this.validMoves.value;
    const isValidMove = currentValidMoves.some(move => 
      move.row === toRow && move.col === toCol
    );
    
    if (!isValidMove) {
      console.log(`Invalid move to ${toRow},${toCol}`);
      console.log('Valid moves:', currentValidMoves);
      return false;
    }
    
    // Create piece object with ALL required properties for backend
    const pieceToSend = {
      ...piece,
      row: fromRow,      // Add current row
      col: fromCol,      // Add current col
      hasMoved: piece.hasMoved || false
    };
    
    // Check if this is a pawn promotion move
    const isPawnPromotion = piece.type === 'pawn' && 
      ((piece.color === 'white' && toRow === 0) || 
       (piece.color === 'black' && toRow === 7));
    
    // Send move to server
    this.wsService.send({
      type: 'move',
      playerId: currentPlayer.id,
      payload: {
        gameId: game.id,
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        piece: pieceToSend,
        promotion: isPawnPromotion ? (promotion || 'queen') : undefined
      }
    });
    
    console.log(`Attempting move: ${piece.color} ${piece.type} from ${fromRow},${fromCol} to ${toRow},${toCol}`);
    if (isPawnPromotion) {
      console.log(`Pawn promotion to: ${promotion || 'queen'}`);
    }
    
    return true;
  }
  
  // Add promotePawn method
  promotePawn(gameId: string, row: number, col: number, promotionType: 'queen' | 'rook' | 'bishop' | 'knight'): void {
    const currentPlayer = this.currentPlayer.value;
    if (!currentPlayer) return;
    
    this.wsService.send({
      type: 'promotion',
      playerId: currentPlayer.id,
      payload: {
        gameId,
        row,
        col,
        promotionType
      }
    });
  }
  
  deselectPiece(): void {
    this.selectedPieceSubject.next(null);
    this.validMoves.next([]);
  }
  
  sendChatMessage(text: string): void {
    const game = this.gameState.value;
    const player = this.currentPlayer.value;
    
    if (!game || !player) return;
    
    this.wsService.send({
      type: 'chat',
      playerId: player.id,
      payload: {
        gameId: game.id,
        text
      }
    });
  }
  
  private handleIncomingMessage(message: WebSocketMessage): void {
    console.log('Received message:', message.type, message.payload);
    
    switch (message.type) {
      case 'welcome':
        this.handleWelcome(message.payload);
        break;
      case 'playerJoined':
        this.handlePlayerJoined(message.payload);
        break;
      case 'move':
        this.handleMove(message.payload);
        break;
      case 'validMoves':
        this.handleValidMoves(message.payload);
        break;
      case 'promotion':
        this.handlePromotion(message.payload);
        break;
      case 'chat':
        this.handleChat(message.payload);
        break;
      case 'error':
        this.handleError(message.payload);
        break;
    }
  }
  
  private handleWelcome(payload: any): void {
    console.log('Welcome payload:', payload);
    
    const player: Player = {
      id: payload.playerId,
      name: payload.color === 'white' ? 'Player 1 (White)' : 'Player 2 (Black)',
      color: payload.color,
      connectedAt: new Date()
    };
    
    const gameState: GameState = {
      id: payload.gameId,
      players: payload.players,
      board: payload.board,
      currentTurn: payload.currentTurn,
      status: payload.status || 'waiting'
    };
    
    this.currentPlayer.next(player);
    this.gameState.next(gameState);
    
    console.log(`Welcome! You are playing as ${player.color}`);
  }
  
  private handlePlayerJoined(payload: any): void {
    console.log('Player joined:', payload);
    
    const game = this.gameState.value;
    if (!game) return;
    
    // Update players list
    const updatedPlayers = [...game.players];
    if (!updatedPlayers.some(p => p.id === payload.player.id)) {
      updatedPlayers.push(payload.player);
    }
    
    const status: 'playing' | 'waiting' | 'finished' = 
      payload.totalPlayers === 2 ? 'playing' : 'waiting';
    
    const updatedGame: GameState = {
      ...game,
      players: updatedPlayers,
      status: status
    };
    
    this.gameState.next(updatedGame);
    
    console.log(`${payload.player.name} joined the game`);
  }
  
  private handleMove(payload: any): void {
    console.log('Move payload received from server:', payload);
    
    const game = this.gameState.value;
    if (!game) return;
    
    // Update board state from server
    const updatedGame: GameState = {
      ...game,
      board: payload.board,
      currentTurn: payload.currentTurn,
      status: payload.status || 'playing',
      check: payload.check,
      checkmate: payload.checkmate,
      stalemate: payload.stalemate,
      winner: payload.winner
    };
    
    this.gameState.next(updatedGame);
    
    // Clear selection and valid moves after successful move
    this.selectedPieceSubject.next(null);
    this.validMoves.next([]);
    
    console.log(`Move completed: ${payload.piece.color} ${payload.piece.type}`);
    if (payload.check) console.log('CHECK!');
    if (payload.checkmate) console.log('CHECKMATE!');
    if (payload.stalemate) console.log('STALEMATE!');
  }
  
  private handlePromotion(payload: any): void {
    console.log('Promotion payload:', payload);
    
    const game = this.gameState.value;
    if (!game) return;
    
    // Update board with promoted piece
    const updatedBoard = [...game.board];
    updatedBoard[payload.row][payload.col] = payload.piece;
    
    const updatedGame: GameState = {
      ...game,
      board: updatedBoard,
      status: payload.status || game.status
    };
    
    this.gameState.next(updatedGame);
    
    console.log(`Pawn promoted to ${payload.piece.type}`);
  }
  
  private handleValidMoves(payload: any): void {
    console.log('Valid moves payload:', payload);
    this.validMoves.next(payload.validMoves);
    console.log(`Received ${payload.validMoves.length} valid moves for ${payload.piece.type}`);
  }
  
  private handleChat(payload: any): void {
    console.log(`Chat from ${payload.playerId}: ${payload.text}`);
  }
  
  private handleError(payload: any): void {
    console.error('Server error:', payload.message);
    // Clear selection on error
    this.selectedPieceSubject.next(null);
    this.validMoves.next([]);
  }
  
  getSelectedPiece(): { row: number; col: number; piece: ChessPiece } | null {
    return this.selectedPieceSubject.value;
  }
  
  getPieceUnicode(piece: ChessPiece): string {
    const unicodePieces: Record<string, Record<string, string>> = {
      white: {
        king: '♔',
        queen: '♕',
        rook: '♖',
        bishop: '♗',
        knight: '♘',
        pawn: '♙'
      },
      black: {
        king: '♚',
        queen: '♛',
        rook: '♜',
        bishop: '♝',
        knight: '♞',
        pawn: '♟'
      }
    };
    
    return unicodePieces[piece.color][piece.type] || '';
  }
}