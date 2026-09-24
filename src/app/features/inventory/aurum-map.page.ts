import { CurrencyPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { InventoryPoint } from '../../core/api/app-api.models';
import { CartService } from '../../core/cart/cart.service';
import { CartDrawerService } from '../../core/cart/cart-drawer.service';
import { InventoryService } from '../../core/inventory/inventory.service';
import { GoogleMapsLoaderService } from '../../core/maps/google-maps-loader.service';

type FilterPanel = 'where' | 'when' | 'audience' | 'investment' | null;

@Component({
  imports: [CurrencyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="aurum-map">
      <form class="map-toolbar" (submit)="search($event)" aria-label="Busca do inventário">
        <button class="map-toolbar__field campaign-field" type="button" (click)="panel.set(null)" title="A campanha será escolhida no checkout"><small>Campanha</small><strong>Escolher no checkout</strong></button>
        <button class="map-toolbar__field" type="button" [class.active]="panel()==='where'" (click)="togglePanel('where')"><small>Onde</small><strong>{{query() || 'Todas as regiões'}}</strong></button>
        <button class="map-toolbar__field" type="button" [class.active]="panel()==='when'" (click)="togglePanel('when')"><small>Quando</small><strong>{{periodicity()}}</strong></button>
        <button class="map-toolbar__field" type="button" [class.active]="panel()==='audience'" (click)="togglePanel('audience')"><small>Público</small><strong>Todos os perfis</strong></button>
        <button class="map-toolbar__field" type="button" [class.active]="panel()==='investment'" (click)="togglePanel('investment')"><small>Investimento</small><strong>{{maxPrice() ? 'Até ' + (maxPrice() | currency:'BRL':'symbol':'1.0-0':'pt-BR') : 'Qualquer valor'}}</strong></button>
        <span class="map-toolbar__spacer"></span>
        <button class="outline-action" type="button" [attr.aria-expanded]="filtersOpen()" (click)="filtersOpen.set(true); panel.set(null)">Mais filtros <span aria-hidden="true">☷</span></button>
        <button class="search-action" type="submit">Buscar</button>
      </form>

      @if (panel(); as activePanel) {
        <div class="toolbar-popover" [class.toolbar-popover--where]="activePanel==='where'" role="dialog" [attr.aria-label]="activePanel==='where'?'Buscar local':activePanel==='when'?'Escolher período':activePanel==='audience'?'Público':'Investimento'">
          @switch (activePanel) {
            @case ('where') { <h2>Onde anunciar?</h2><label for="map-query">Cidade, bairro ou avenida</label><input id="map-query" type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Ex.: Avenida Paulista" /><p>A busca encontra locais e peças no inventário desta exibidora.</p> }
            @case ('when') { <h2>Quando</h2><p class="field-label">Periodicidade</p><div class="period-options">@for (period of ['Semanal','Bissemanal','Mensal']; track period) { <button type="button" [class.selected]="periodicity()===period" (click)="periodicity.set(period)">{{period}}</button> }</div><p>A disponibilidade por datas será confirmada antes de fechar o pedido.</p> }
            @case ('audience') { <h2>Público</h2><p>Dados demográficos e de renda ainda não são fornecidos pelo inventário WhiteLabel. A busca atual considera local, tipo de suporte e investimento.</p> }
            @case ('investment') { <h2>Investimento</h2><label for="map-max-price">Valor máximo por peça</label><select id="map-max-price" [value]="maxPrice() ?? ''" (change)="maxPrice.set($any($event.target).value ? +$any($event.target).value : null)"><option value="">Qualquer valor</option><option value="5000">Até R$ 5 mil</option><option value="10000">Até R$ 10 mil</option><option value="20000">Até R$ 20 mil</option><option value="30000">Até R$ 30 mil</option></select> }
          }
          <div class="popover-actions"><button type="button" (click)="clearActivePanel()">Limpar</button><button type="button" (click)="applyPanel()">Aplicar</button></div>
        </div>
      }

      <div class="map-workspace">
        <aside class="map-results" [class.sheet-expanded]="sheetExpanded()" aria-label="Pontos encontrados">
          <div class="map-results__heading"><span>Inventário</span><strong>{{points().length}} {{points().length===1?'ponto encontrado':'pontos encontrados'}}</strong><button type="button" class="sheet-toggle" (click)="sheetExpanded.update(value=>!value)">{{sheetExpanded()?'Ver mapa':'Ver lista'}}</button></div>
          @if(sheetExpanded()) { <form class="mobile-filters" (submit)="search($event)"><label for="mobile-inventory-query">Buscar local</label><div><input id="mobile-inventory-query" type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Cidade, bairro ou avenida" /><button type="submit">Buscar</button></div><button type="button" (click)="filtersOpen.set(true)">Mais filtros ☷</button></form> }
          @if (loading()) { <p class="map-feedback" role="status">Buscando pontos…</p> }
          @else if (error()) { <p class="map-feedback" role="alert">{{error()}} <button type="button" (click)="load()">Tentar novamente</button></p> }
          @else if (!points().length) { <p class="map-feedback">Nenhum ponto corresponde à busca. Ajuste os filtros.</p> }
          @else { <div class="map-results__list">
            @for (point of points(); track point.id) {
              <article class="map-card" [class.selected]="selectedId()===point.id" (mouseenter)="highlight(point.id)" (mouseleave)="highlightedId.set(null)">
                <button class="map-card__media" type="button" (click)="select(point.id)" [attr.aria-label]="'Selecionar '+point.name">
                  @if (point.imageUrl) { <img [src]="point.imageUrl" [alt]="point.name" /> } @else { <span>Foto da peça</span> }
                  <b>{{point.mediaType || 'Mídia exterior'}}</b>
                </button>
                <div class="map-card__content"><h2>{{point.name}}</h2><p>⌖ {{point.address}}</p><div class="map-card__price"><span>Valor de referência</span><strong>{{point.price | currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong></div><button type="button" (click)="select(point.id)">Ver ponto →</button></div>
              </article>
            }
          </div> }
        </aside>
        <section class="map-canvas" aria-label="Mapa do inventário">
          <button class="mobile-map-search" type="button" (click)="sheetExpanded.set(true)"><strong>{{query() || 'Buscar peças'}}</strong><small>{{points().length}} {{points().length===1?'ponto encontrado':'pontos encontrados'}} · abrir lista</small></button>
          <div #mapCanvas class="google-map" [class.is-unavailable]="mapError()" aria-label="Mapa Google com os pontos do inventário"></div>
          @if (mapLoading()) { <div class="map-state" role="status">Carregando mapa…</div> }
          @if (mapError()) { <div class="map-state map-state--error" role="alert"><strong>Mapa indisponível</strong><span>{{mapError()}}</span></div> }
          @if (selected(); as point) {
            <div class="map-popup" role="dialog" [attr.aria-label]="'Detalhes de '+point.name">
              <button class="map-popup__close" type="button" aria-label="Fechar detalhes" (click)="selectedId.set(null)">×</button>
              <div class="map-popup__media">@if(point.imageUrl){<img [src]="point.imageUrl" [alt]="point.name" />}@else{<span>Foto da peça indisponível</span>}</div>
              <div class="map-popup__body"><span class="media-chip">{{point.mediaType}}</span><h2>{{point.name}}</h2><p>{{point.address}} · {{point.city}}</p><dl><div><dt>Código</dt><dd>{{point.code}}</dd></div><div><dt>Formato</dt><dd>{{point.format}}</dd></div></dl><small>Veiculação · valor de referência</small><strong>{{point.price | currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong><button type="button" (click)="addToCart(point)" [disabled]="!point.available">{{cart.contains(point.id)?'Adicionada ao carrinho':'Adicionar ao carrinho'}}</button><a [routerLink]="['/pecas',point.code]">Ver detalhes</a></div>
            </div>
          }
        </section>
      </div>
      @if(filtersOpen()){
        <button class="filter-scrim" type="button" aria-label="Fechar filtros" (click)="filtersOpen.set(false)"></button>
        <aside class="filter-drawer" aria-label="Mais filtros" role="dialog" aria-modal="true"><header><h2>Mais filtros</h2><button type="button" aria-label="Fechar filtros" (click)="filtersOpen.set(false)">×</button></header><div class="filter-drawer__body"><h3>Tipos de suporte</h3>@for(type of mediaTypes();track type){<label><input type="checkbox" [checked]="selectedMediaTypes().includes(type)" (change)="toggleMedia(type)" />{{type}}</label>}@if(!mediaTypes().length){<p>Os tipos serão exibidos após carregar o inventário.</p>}<hr/><h3>Próximos de (POI)</h3><input type="search" placeholder="Buscar ponto de interesse…" disabled aria-label="Busca de POI indisponível" /><p>A busca por POI depende dos dados de localização do BFF.</p></div><footer><button type="button" (click)="selectedMediaTypes.set([]); filtersOpen.set(false); load()">Limpar</button><button type="button" (click)="filtersOpen.set(false); load()">Refinar</button></footer></aside>
      }
    </div>
  `,
})
export class AurumMapPage implements AfterViewInit {
  @ViewChild('mapCanvas') private mapCanvas?: ElementRef<HTMLElement>;
  private readonly inventory = inject(InventoryService);
  private readonly mapsLoader = inject(GoogleMapsLoaderService);
  readonly cart = inject(CartService);
  private readonly cartDrawer = inject(CartDrawerService);
  private maps: any;
  private map: any;
  private markers: any[] = [];
  private viewReady = false;
  readonly points = signal<InventoryPoint[]>([]);
  readonly mediaTypes = signal<string[]>([]);
  readonly selectedMediaTypes = signal<string[]>([]);
  readonly query = signal('');
  readonly maxPrice = signal<number | null>(null);
  readonly periodicity = signal('Bissemanal');
  readonly panel = signal<FilterPanel>(null);
  readonly filtersOpen = signal(false);
  readonly sheetExpanded = signal(false);
  readonly selectedId = signal<number | null>(null);
  readonly highlightedId = signal<number | null>(null);
  readonly selected = computed(() => this.points().find(point => point.id === this.selectedId()) ?? null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly mapLoading = signal(false);
  readonly mapError = signal('');

  constructor() { this.load(); }
  ngAfterViewInit() { this.viewReady = true; void this.renderMap(); }
  @HostListener('document:keydown.escape') onEscape() { this.panel.set(null); this.filtersOpen.set(false); this.selectedId.set(null); }
  togglePanel(value: Exclude<FilterPanel, null>) { this.filtersOpen.set(false); this.panel.update(current => current === value ? null : value); }
  clearActivePanel() { if(this.panel()==='where') this.query.set(''); if(this.panel()==='investment') this.maxPrice.set(null); this.panel.set(null); this.load(); }
  applyPanel() { this.panel.set(null); this.load(); }
  search(event: Event) { event.preventDefault(); this.panel.set(null); this.load(); }
  toggleMedia(type: string) { this.selectedMediaTypes.update(current => current.includes(type) ? current.filter(value => value!==type) : [...current,type]); }
  addToCart(point: InventoryPoint) { this.cart.add(point); this.cartDrawer.open.set(true); }
  highlight(id: number) { this.highlightedId.set(id); }
  select(id: number) { this.selectedId.set(id); this.sheetExpanded.set(false); const point=this.points().find(item=>item.id===id); if(point&&this.map){this.map.panTo({lat:point.latitude,lng:point.longitude});this.map.setZoom(15);} }
  load() {
    this.loading.set(true); this.error.set('');
    this.inventory.search({query:this.query(),maxPrice:this.maxPrice()??undefined}).pipe(finalize(()=>this.loading.set(false))).subscribe({
      next: all => {
        if(!this.query() && !this.maxPrice() && !this.mediaTypes().length) this.mediaTypes.set([...new Set(all.map(point=>point.mediaType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')));
        const chosen=this.selectedMediaTypes();
        const points=chosen.length ? all.filter(point=>chosen.includes(point.mediaType)) : all;
        this.points.set(points);
        if(this.selectedId() && !points.some(point=>point.id===this.selectedId())) this.selectedId.set(null);
        void this.renderMap();
      },
      error:()=>this.error.set('Não foi possível carregar o inventário.'),
    });
  }
  private async renderMap() {
    if(!this.viewReady||!this.mapCanvas)return;
    this.mapLoading.set(true); this.mapError.set('');
    try {
      this.maps??=await this.mapsLoader.load();
      if(!this.map) this.map=new this.maps.Map(this.mapCanvas.nativeElement,{center:{lat:-23.5614,lng:-46.6559},zoom:12,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,clickableIcons:false,gestureHandling:'cooperative'});
      this.markers.forEach(marker=>marker.setMap(null));this.markers=[];
      const bounds=new this.maps.LatLngBounds();
      this.points().forEach((point,index)=>{
        if(!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude))return;
        const marker=new this.maps.Marker({map:this.map,position:{lat:point.latitude,lng:point.longitude},label:{text:String(index+1),color:'#ffffff',fontWeight:'700'},title:point.name,icon:{path:this.maps.SymbolPath.CIRCLE,scale:this.highlightedId()===point.id?18:15,fillColor:this.selectedId()===point.id?'#d9b442':'#8a0009',fillOpacity:1,strokeColor:'#fff',strokeWeight:2}});
        marker.addListener('click',()=>this.select(point.id));this.markers.push(marker);bounds.extend(marker.getPosition());
      });
      if(this.markers.length===1){this.map.setCenter(bounds.getCenter());this.map.setZoom(14);}else if(this.markers.length>1)this.map.fitBounds(bounds,76);
    }catch(error){this.mapError.set(error instanceof Error?error.message:'Não foi possível carregar o Google Maps.');}
    finally{this.mapLoading.set(false);}
  }
}
