import { CurrencyPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { InventoryPoint, InventorySearch } from '../../core/api/app-api.models';
import { InventoryService } from '../../core/inventory/inventory.service';
import { GoogleMapsLoaderService } from '../../core/maps/google-maps-loader.service';

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
              <article class="point-card" [class.is-selected]="selectedId() === point.id" (mouseenter)="select(point.id)" (mouseleave)="selectedId.set(null)">
                <button type="button" class="point-card__select" (click)="select(point.id)" [attr.aria-label]="'Selecionar ' + point.name"><span class="point-card__icon">{{ point.mediaType === 'Digital OOH' ? '▦' : '▣' }}</span></button>
                <div class="point-card__body"><div class="point-card__title"><h2>{{ point.name }}</h2><span [class.unavailable]="!point.available">{{ point.available ? 'Disponível' : 'Indisponível' }}</span></div><p>{{ point.address }}</p><div class="point-card__meta"><span>{{ point.mediaType }}</span><span>{{ point.format }}</span></div><div class="point-card__bottom"><strong>{{ point.price | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</strong><a [routerLink]="['/pecas', point.code]">Ver peça</a></div></div>
              </article>
            }
          </div>
        }
      </aside>
      <section class="map-panel" aria-label="Visualização do inventário">
        <button class="mobile-map-search" type="button" (click)="sheetExpanded.set(true)" aria-controls="inventory-results" [attr.aria-expanded]="sheetExpanded()"><strong>{{query()||'São Paulo · Buscar peças'}}</strong><span>{{points().length}} pontos encontrados · abrir filtros</span></button>
        <div #mapCanvas class="google-map" [class.is-unavailable]="mapError()" aria-label="Mapa Google com as peças encontradas"></div>
        @if (mapLoading()) { <div class="map-state" role="status">Carregando mapa…</div> }
        @if (mapError()) { <div class="map-state map-state--error" role="alert"><strong>Mapa indisponível</strong><span>{{ mapError() }}</span></div> }
        @if (selected(); as point) { <div class="map-selection"><strong>{{ point.name }}</strong><span>{{ point.address }}</span><a [routerLink]="['/pecas', point.code]">Ver detalhes da peça</a></div> }
      </section>
    </div>
  `,
})
export class MapPage implements AfterViewInit {
  @ViewChild('mapCanvas') private mapCanvas?: ElementRef<HTMLElement>;
  private readonly inventory = inject(InventoryService);
  private readonly mapsLoader = inject(GoogleMapsLoaderService);
  private maps: any;
  private map: any;
  private markers: any[] = [];
  private viewReady = false;
  readonly points = signal<InventoryPoint[]>([]);
  readonly sheetExpanded = signal(false);
  readonly selectedId = signal<number | null>(null);
  readonly selected = computed(() => this.points().find((point) => point.id === this.selectedId()) ?? null);
  readonly query = signal(''); readonly mediaType = signal(''); readonly loading = signal(false); readonly error = signal('');
  readonly mapLoading = signal(false); readonly mapError = signal('');
  constructor() { this.load(); }
  ngAfterViewInit() { this.viewReady = true; void this.renderMap(); }
  search(event: Event) { event.preventDefault(); this.load(); }
  changeMedia(value: string) { this.mediaType.set(value); this.load(); }
  load() {
    const filter: InventorySearch = { query: this.query(), mediaType: this.mediaType() };
    this.loading.set(true); this.error.set('');
    this.inventory.search(filter).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (points) => { this.points.set(points); void this.renderMap(); },
      error: () => this.error.set('Não foi possível carregar o inventário.'),
    });
  }

  select(id: number) {
    this.selectedId.set(id);
    const point = this.points().find((item) => item.id === id);
    if (point && this.map) {
      this.map.panTo({ lat: point.latitude, lng: point.longitude });
      this.map.setZoom(15);
    }
  }

  private async renderMap() {
    if (!this.viewReady || !this.mapCanvas || !this.points().length) return;
    this.mapLoading.set(true); this.mapError.set('');
    try {
      this.maps ??= await this.mapsLoader.load();
      if (!this.map) {
        this.map = new this.maps.Map(this.mapCanvas.nativeElement, {
          center: { lat: -23.5614, lng: -46.6559 }, zoom: 12,
          mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
          clickableIcons: false, gestureHandling: 'cooperative',
        });
      }
      this.markers.forEach((marker) => marker.setMap(null));
      this.markers = [];
      const bounds = new this.maps.LatLngBounds();
      this.points().forEach((point, index) => {
        const marker = new this.maps.Marker({
          map: this.map, position: { lat: point.latitude, lng: point.longitude },
          label: { text: String(index + 1), color: '#ffffff', fontWeight: '700' },
          title: point.name,
          opacity: point.available ? 1 : .55,
        });
        marker.addListener('click', () => this.select(point.id));
        this.markers.push(marker);
        bounds.extend(marker.getPosition());
      });
      if (this.points().length === 1) this.map.setCenter(bounds.getCenter());
      else this.map.fitBounds(bounds, 76);
    } catch (error) {
      this.mapError.set(error instanceof Error ? error.message : 'Não foi possível carregar o Google Maps.');
    } finally {
      this.mapLoading.set(false);
    }
  }
}
