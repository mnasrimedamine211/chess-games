import { ChessPiece } from './chess-piece.model';
import { Move } from './move.model';
import { Player } from './player.model';

export interface GameState {
  id: string;
  players: Player[];
  board: (ChessPiece | null)[][];
  currentTurn: 'white' | 'black';
  status: 'waiting' | 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw' | 'finished';
  winner?: 'white' | 'black';
  check?: boolean;
  checkmate?: boolean;
  stalemate?: boolean;
  lastMove?: Move;
}