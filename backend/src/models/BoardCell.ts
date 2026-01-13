import { ChessPiece } from "./ChessPiece";

export interface BoardCell {
  piece: ChessPiece | null;
  row: number;
  col: number;
  color: 'light' | 'dark';
}