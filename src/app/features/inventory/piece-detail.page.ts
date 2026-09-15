import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InventoryPoint } from '../../core/api/app-api.models';
import { CartService } from '../../core/cart/cart.service';
import { InventoryService } from '../../core/inventory/inventory.service';

@Component({
  imports: [CurrencyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="piece-page">
      <a class="back-link" routerLink="/mapa">← Voltar</a>
      @if (error()) {
        <div class="piece-error" role="alert">{{ error() }} <a routerLink="/mapa">Explorar outras peças</a></div>
      } @else if (point(); as piece) {
        <div class="piece-layout">
          <div class="piece-visual"><div class="piece-visual__frame"><span class="piece-media-chip">{{ piece.mediaType }}</span><p>foto / street view · indisponível no inventário</p></div></div>
          <div class="piece-info">
            <p class="eyebrow">Peça {{ piece.code }}</p>
            <h1>{{ piece.name }}</h1>
            <p class="piece-address">{{ piece.address }} · {{ piece.city }}, {{ piece.state }}</p>
            <section class="piece-facts" aria-labelledby="piece-characteristics">
              <h2 id="piece-characteristics">Características da peça</h2>
              <div><small>Formato</small><strong>{{ piece.format || 'Não informado' }}</strong></div>
              <div><small>Iluminação</small><strong>{{ piece.illuminated ? 'Iluminada' : 'Não informada' }}</strong></div>
              <div><small>Disponibilidade</small><strong [class.unavailable]="!piece.available">{{ piece.available ? 'Publicada no catálogo' : 'Indisponível' }}</strong></div>
            </section>
            <section class="piece-facts piece-facts--location" aria-labelledby="location-characteristics">
              <h2 id="location-characteristics">Características do local</h2>
              <div><small>Cidade</small><strong>{{ piece.city }}, {{ piece.state }}</strong></div>
              <div><small>Referência</small><strong>{{ piece.address }}</strong></div>
            </section>
            <div class="purchase-box">
              <small>Veiculação</small><strong>{{ piece.price | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</strong>
              <p>Valor de referência. A cotação confirma valor e disponibilidade por período.</p>
              <button (click)="add(piece)" [disabled]="!piece.available || cart.contains(piece.id)">{{ cart.contains(piece.id) ? 'Adicionada ao carrinho' : 'Adicionar ao carrinho' }}</button>
              @if (cart.contains(piece.id)) { <a routerLink="/checkout">Ir para o carrinho</a> }
            </div>
          </div>
        </div>
      } @else { <p role="status">Carregando peça…</p> }
    </section>
  `,
})
export class PieceDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly inventory = inject(InventoryService);
  private readonly router = inject(Router);
  readonly cart = inject(CartService);
  readonly point = signal<InventoryPoint | null>(null);
  readonly error = signal('');

  constructor() {
    const code = this.route.snapshot.paramMap.get('codigo') ?? '';
    this.inventory.getByCode(code).subscribe({ next: (value) => this.point.set(value), error: () => this.error.set('Esta peça não foi encontrada.') });
  }

  add(point: InventoryPoint) {
    this.cart.add(point);
    void this.router.navigate(['/checkout']);
  }
}
