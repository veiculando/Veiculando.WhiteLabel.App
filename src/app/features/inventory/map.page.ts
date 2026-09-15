import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { InventoryPoint, InventorySearch } from '../../core/api/app-api.models';
import { CartService } from '../../core/cart/cart.service';
import { InventoryService } from '../../core/inventory/inventory.service';
import { environment } from '../../../environments/environment';

@Component({
  imports: [CurrencyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inventory-workspace">
      <aside id="inventory-results" class="results-panel" [class.sheet-expanded]="sheetExpanded()" aria-label="Peças encontradas">
        <div class="panel-intro">
          <p class="eyebrow">Inventário de mídia exterior</p>
          <h1>Encontre o ponto certo.</h1>
          <p>Busque na cidade e compare as peças disponíveis.</p>
        </div>
        <form class="search" (submit)="search($event)">
          <label for="inventory-query">Onde você quer anunciar?</label>
          <div class="search-row"><input id="inventory-query" type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Bairro, avenida ou região" /><button type="submit">Buscar</button></div>
        </form>
        <div class="filter-row"><label for="media-type">Tipo de mídia</label><select id="media-type" [value]="mediaType()" (change)="changeMedia($any($event.target).value)"><option value="">Todos os formatos</option><option value="Outdoor">Outdoor</option><option value="Relógio de rua">Relógio de rua</option><option value="Digital OOH">Digital OOH</option></select></div>
        <div class="result-heading"><strong><span class="result-count-desktop">{{ points().length }} peças encontradas</span><span class="result-count-mobile">{{ points().length }} peças próximas</span></strong><button class="sheet-toggle" type="button" [attr.aria-expanded]="sheetExpanded()" aria-controls="inventory-results" (click)="sheetExpanded.set(!sheetExpanded())">{{sheetExpanded()?'Ver mapa':'Mais filtros ⌄'}}</button></div>
        @if (loading()) { <p class="feedback" role="status">Buscando peças disponíveis…</p> }
        @else if (error()) { <div class="feedback error" role="alert">{{ error() }} <button type="button" (click)="load()">Tentar novamente</button></div> }
        @else if (!points().length) { <div class="feedback">Nenhuma peça corresponde à busca. Tente outro bairro ou formato.</div> }
        @else {
          <div class="result-list">
            @for (point of points(); track point.id) {
              <article class="point-card" [class.is-selected]="selectedId() === point.id" (mouseenter)="selectedId.set(point.id)" (mouseleave)="selectedId.set(null)">
                <button type="button" class="point-card__select" (click)="selectedId.set(point.id)" [attr.aria-label]="'Selecionar ' + point.name"><span class="point-card__icon">{{ point.mediaType === 'Digital OOH' ? '▦' : '▣' }}</span></button>
                <div class="point-card__body"><div class="point-card__title"><h2>{{ point.name }}</h2><span [class.unavailable]="!point.available">{{ point.available ? 'Disponível' : 'Indisponível' }}</span></div><p>{{ point.address }}</p><div class="point-card__meta"><span>{{ point.mediaType }}</span><span>{{ point.format }}</span></div><div class="point-card__bottom"><strong>{{ point.price | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</strong><a [routerLink]="['/pecas', point.code]">Ver peça</a></div></div>
              </article>
            }
          </div>
        }
      </aside>
      <section class="map-panel" aria-label="Visualização do inventário">
        <button class="mobile-map-search" type="button" (click)="sheetExpanded.set(true)" aria-controls="inventory-results" [attr.aria-expanded]="sheetExpanded()"><strong>{{query()||'São Paulo · Buscar peças'}}</strong><span>{{points().length}} pontos encontrados · abrir filtros</span></button>
        @if (prototype) { <div class="map-prototype-note">Prévia de navegação · mapa geográfico ainda não conectado</div> }
        <div class="map-grid" aria-hidden="true"><span class="avenue avenue--one"></span><span class="avenue avenue--two"></span><span class="avenue avenue--three"></span><span class="park"></span><span class="river"></span><span class="district district--one">Jardins</span><span class="district district--two">Pinheiros</span><span class="district district--three">Moema</span></div>
        @for (point of points(); track point.id) {
          <button class="map-pin" [class.is-selected]="selectedId()===point.id" [class.is-unavailable]="!point.available" [style.left.%]="pinX(point)" [style.top.%]="pinY(point)" (click)="selectedId.set(point.id)" [attr.aria-pressed]="selectedId()===point.id" [attr.aria-label]="point.name + ', ' + (point.price | currency:'BRL':'symbol':'1.0-0':'pt-BR')">{{ $index + 1 }}</button>
        }
        @if (selected(); as point) { <div class="map-selection"><strong>{{ point.name }}</strong><span>{{ point.address }}</span><a [routerLink]="['/pecas', point.code]">Ver detalhes da peça</a></div> }
        <div class="map-attribution">Visualização ilustrativa da cidade · coordenadas das peças preservadas no adapter</div>
      </section>
    </div>
  `,
})
export class MapPage {
  private readonly inventory = inject(InventoryService);
  readonly cart = inject(CartService);
  readonly prototype = environment.usePrototypeFixtures;
  readonly points = signal<InventoryPoint[]>([]);
  readonly sheetExpanded = signal(false);
  readonly selectedId = signal<number | null>(null);
  readonly selected = computed(() => this.points().find((point) => point.id === this.selectedId()) ?? null);
  readonly query = signal(''); readonly mediaType = signal(''); readonly loading = signal(false); readonly error = signal('');
  constructor() { this.load(); }
  search(event: Event) { event.preventDefault(); this.load(); }
  changeMedia(value: string) { this.mediaType.set(value); this.load(); }
  load() {
    const filter: InventorySearch = { query: this.query(), mediaType: this.mediaType() };
    this.loading.set(true); this.error.set('');
    this.inventory.search(filter).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (points) => this.points.set(points),
      error: () => this.error.set('Não foi possível carregar o inventário.'),
    });
  }
  pinX(point: InventoryPoint) { return Math.max(12, Math.min(88, 50 + (point.longitude + 46.67) * 950)); }
  pinY(point: InventoryPoint) { return Math.max(15, Math.min(85, 50 + (point.latitude + 23.58) * 1350)); }
}
