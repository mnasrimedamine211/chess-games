import { Component, Input } from '@angular/core';
import { ChessPiece } from '../../core/models/chess-piece.model';
import { GameService } from '../../core/services/game.service';

@Component({
  selector: 'app-chess-piece',
  imports: [],
  templateUrl: './chess-piece.component.html',
  styleUrl: './chess-piece.component.scss'
})
export class ChessPieceComponent {
   @Input() piece: ChessPiece | null = null;
  @Input() isSelected = false;
  @Input() isValidMove = false;
  
  constructor(private gameService: GameService) {}
  
  getPieceIcon(): string { 

    if (!this.piece) return '';
    return this.gameService.getPieceUnicode(this.piece);
  }
}
