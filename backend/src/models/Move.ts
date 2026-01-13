import { ChessPiece } from "./ChessPiece";

export interface Move {
  from: { row: number; col: number };
  to: { row: number; col: number };
  piece: ChessPiece;
  playerId: string;
  timestamp: Date;
}