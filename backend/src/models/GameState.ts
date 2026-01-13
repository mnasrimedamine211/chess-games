import { ChessPiece } from './ChessPiece';
import { Player } from './Player';

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
  enPassantTarget?: { row: number; col: number }; // For en passant
  castlingRights: {
    white: { kingside: boolean; queenside: boolean };
    black: { kingside: boolean; queenside: boolean };
  };
  halfMoveClock: number; // For 50-move rule
  fullMoveNumber: number;
  lastMove?: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    piece: ChessPiece;
    playerId: string;
    timestamp: Date;
    promotion?: ChessPiece['type']; // If pawn was promoted
    isCastle?: boolean;
    isEnPassant?: boolean;
  };
}