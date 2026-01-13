import { ChessPiece } from "./chess-piece.model";

export interface Move {
  from: { row: number; col: number };
  to: { row: number; col: number };
  piece: ChessPiece;
  playerId: string;
  timestamp: Date;
}
