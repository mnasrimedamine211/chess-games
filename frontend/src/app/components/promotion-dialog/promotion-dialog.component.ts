import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-promotion-dialog',
    imports: [CommonModule],
  
  templateUrl: './promotion-dialog.component.html',
  styleUrl: './promotion-dialog.component.scss'
})
export class PromotionDialogComponent {
  @Input() visible = false;
  @Input() pieceColor: 'white' | 'black' = 'white';
  @Output() promotionSelected = new EventEmitter<'queen' | 'rook' | 'bishop' | 'knight'>();
  
  selectPromotion(pieceType: 'queen' | 'rook' | 'bishop' | 'knight') {
    this.promotionSelected.emit(pieceType);
  }
  
  getPieceIcon(pieceType: 'queen' | 'rook' | 'bishop' | 'knight'): string {
    const unicodePieces = {
      white: {
        queen: '♕',
        rook: '♖',
        bishop: '♗',
        knight: '♘'
      },
      black: {
        queen: '♛',
        rook: '♜',
        bishop: '♝',
        knight: '♞'
      }
    };
    
    return unicodePieces[this.pieceColor][pieceType];
  }
}
