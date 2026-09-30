import { CurrencyPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CheckoutCampaign, InventoryPoint } from '../../core/api/app-api.models';
import { AdvertiserAuthService } from '../../core/auth/advertiser-auth.service';
import { CartService } from '../../core/cart/cart.service';
import { CartDrawerService } from '../../core/cart/cart-drawer.service';
import { CampaignSelectionService } from '../../core/checkout/campaign-selection.service';
import { CheckoutService } from '../../core/checkout/checkout.service';
import { InventoryService } from '../../core/inventory/inventory.service';
import { clampPage, pageCount, pageItems } from '../../core/inventory/pagination';
import { GoogleMapsLoaderService } from '../../core/maps/google-maps-loader.service';

type FilterPanel = 'campaign' | 'where' | 'when' | 'audience' | 'investment' | null;
type PoiPlace = { name: string; category: string; latitude: number; longitude: number };

const POI_RADIUS_METERS = 5000;

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (b.latitude - a.latitude) * radians;
  const longitudeDelta = (b.longitude - a.longitude) * radians;
  const arc = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 12742000 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export function supportIcon(mediaType: string): string {
  const type = mediaType.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (type.includes('relogio')) return 'icon_relogio-rua.png';
  if (type.includes('painel led') || type.includes('digital')) return 'icon_painel-led.png';
  if (type.includes('abrigo')) return 'icon_abrigo-onibus.png';
  if (type.includes('empena')) return 'icon_empena.png';
  if (type.includes('outdoor')) return type.includes('premium') || type.includes('especial') ? 'icon_outdoor-special.png' : 'icon_outdoor-standard.png';
  if (type.includes('indoor')) return 'icon_indoor.png';
  if (type.includes('frontlight')) return 'icon_frontlight.png';
  if (type.includes('mupi')) return 'icon_mupi.png';
  if (type.includes('banca')) return 'icon_banca.png';
  if (type.includes('triedro')) return 'icon_triedro.png';
  if (type.includes('aeroporto')) return 'icon_aeroporto.png';
  if (type.includes('rodoviario')) return 'icon_painel-rodoviario.png';
  if (type.includes('movel')) return 'icon_midia-movel.png';
  return 'icon_indefinido.png';
}

export function recommendationList(points: InventoryPoint[], onlyRecommended: boolean): InventoryPoint[] {
  return onlyRecommended ? points.filter(point => point.recommended) : points;
}

@Component({
  imports: [CurrencyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="aurum-map">
      <form class="map-toolbar" (submit)="search($event)" aria-label="Busca do inventário">
        <button class="map-toolbar__field campaign-field" type="button" [class.active]="panel()==='campaign'" (click)="togglePanel('campaign')"><small>Campanha</small><strong>{{selectedCampaign()?.name || 'Selecionar ou criar'}}</strong></button>
        <button class="map-toolbar__field" type="button" [class.active]="panel()==='where'" (click)="togglePanel('where')"><small>Onde</small><strong>{{query() || city() || 'Todas as regiões'}}</strong></button>
        <button class="map-toolbar__field" type="button" [class.active]="panel()==='when'" (click)="togglePanel('when')"><small>Quando</small><strong>{{selectedPeriod()?.name || 'Escolher período'}}</strong></button>
        <button class="map-toolbar__field" type="button" [class.active]="panel()==='audience'" (click)="togglePanel('audience')"><small>Público</small><strong>{{audienceActive()?'Perfil selecionado':'Todos os perfis'}}</strong></button>
        <button class="map-toolbar__field" type="button" [class.active]="panel()==='investment'" (click)="togglePanel('investment')"><small>Investimento</small><strong>{{investmentLabel()}}</strong></button>
        <span class="map-toolbar__spacer"></span>
        <button class="outline-action" type="button" [attr.aria-expanded]="filtersOpen()" (click)="filtersOpen.set(true); panel.set(null)">Mais filtros <span aria-hidden="true">☷</span></button>
        <button class="search-action" type="submit">Buscar</button>
      </form>

      @if (panel(); as activePanel) {
        <div class="toolbar-popover" [class.toolbar-popover--where]="activePanel==='where'" [class.toolbar-popover--campaign]="activePanel==='campaign'" role="dialog" [attr.aria-label]="activePanel==='campaign'?'Escolher campanha':activePanel==='where'?'Buscar local':activePanel==='when'?'Escolher período':activePanel==='audience'?'Público':'Investimento'">
          @switch (activePanel) {
            @case ('campaign') {
              <h2>Campanha</h2>
              @if (!auth.user()) { <p>Você pode explorar o mapa sem login. Entre para escolher ou criar uma campanha.</p><a routerLink="/login" [queryParams]="{returnUrl:'/mapa'}">Entrar</a> }
              @else if (auth.user()?.kycStatus !== 'approved') { <p>Seu cadastro precisa ser aprovado para criar ou selecionar uma campanha.</p><a routerLink="/kyc-status">Ver andamento do cadastro</a> }
              @else {
                <label for="map-campaign">Campanha existente</label>
                <select id="map-campaign" [value]="campaignSelection.campaignId() ?? ''" (change)="selectCampaign($any($event.target).value)"><option value="">Escolher campanha</option>@for(campaign of campaigns();track campaign.id){<option [value]="campaign.id">{{campaign.name}}</option>}</select>
                <button class="campaign-create-toggle" type="button" (click)="creatingCampaign.update(value=>!value)">{{creatingCampaign()?'Cancelar criação':'+ Criar campanha'}}</button>
                @if(creatingCampaign()) { <div class="campaign-create-fields">@if(agencyClients();as clients){<label for="campaign-client">Anunciante representado</label><select id="campaign-client" [value]="newCampaignClientId() ?? ''" (change)="newCampaignClientId.set(+$any($event.target).value || null)"><option value="">Selecione o anunciante</option>@for(client of clients;track client.id){<option [value]="client.id">{{client.name}}</option>}</select>@if(!clients.length){<p>Nenhum anunciante com contrato ativo nesta exibidora. Solicite o vínculo antes de criar a campanha.</p>}}<label for="campaign-name">Nome</label><input id="campaign-name" [value]="newCampaignName()" (input)="newCampaignName.set($any($event.target).value)" /><label for="campaign-product">Produto</label><input id="campaign-product" [value]="newCampaignProduct()" (input)="newCampaignProduct.set($any($event.target).value)" /><label for="campaign-job">Job (opcional)</label><input id="campaign-job" [value]="newCampaignJob()" (input)="newCampaignJob.set($any($event.target).value)" /><label for="campaign-start">Início previsto</label><input id="campaign-start" type="date" [value]="newCampaignStart()" (input)="newCampaignStart.set($any($event.target).value)" /><label for="campaign-end">Fim previsto</label><input id="campaign-end" type="date" [value]="newCampaignEnd()" (input)="newCampaignEnd.set($any($event.target).value)" /><label for="campaign-budget">Verba planejada</label><input id="campaign-budget" type="number" min="0" [value]="newCampaignBudget()" (input)="newCampaignBudget.set(+$any($event.target).value)" /><button type="button" (click)="createCampaign()" [disabled]="campaignBusy() || (agencyClients() !== null && !newCampaignClientId())">{{campaignBusy()?'Salvando…':'Criar e selecionar'}}</button></div> }
                @if(campaignError()){<p role="alert">{{campaignError()}}</p>}
              }
            }
            @case ('where') { <h2>Onde anunciar?</h2><label for="map-city">Cidade</label><input id="map-city" list="map-cities" [value]="city()" (input)="city.set($any($event.target).value)" placeholder="Todas as cidades" /><datalist id="map-cities">@for(item of cities();track item.name+'/'+item.state){<option [value]="item.name">{{item.state}}</option>}</datalist><label for="map-query">Bairro, avenida ou local</label><input id="map-query" type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Ex.: Avenida Paulista" /><p>A busca encontra locais e peças no inventário desta exibidora.</p> }
            @case ('when') { <h2>Quando</h2><p class="field-label">Periodicidade</p><div class="period-options">@for (period of ['Semanal','Bissemanal','Mensal']; track period) { <button type="button" [class.selected]="periodicity()===period" (click)="choosePeriodicity(period)">{{period}}</button> }</div><div class="period-list" role="radiogroup" aria-label="Período de veiculação">@for(period of visiblePeriods();track period.code){<label><input type="radio" name="map-period" [checked]="campaignSelection.periodCode()===period.code" (change)="campaignSelection.periodCode.set(period.code)" />{{period.name}}</label>}@if(!visiblePeriods().length){<p>Não há períodos futuros para esta periodicidade.</p>}</div><p>Selecione um período. Preço e disponibilidade serão confirmados na cotação.</p> }
            @case ('audience') { <h2>Público</h2><p>Priorize pontos com o perfil desejado, como na busca do Veiculando.</p><p class="field-label">Gênero</p><div class="audience-options"><label><input type="radio" name="audience-gender" [checked]="gender()===0" (change)="gender.set(0)" />Todos</label><label><input type="radio" name="audience-gender" [checked]="gender()===1" (change)="gender.set(1)" />Masculino</label><label><input type="radio" name="audience-gender" [checked]="gender()===2" (change)="gender.set(2)" />Feminino</label></div><p class="field-label">Faixa etária</p><div class="audience-options">@for(option of ageRanges();track option.id){<label><input type="checkbox" [checked]="ageRangeIds().includes(option.id)" (change)="toggleAudienceOption('age',option.id)" />{{option.name}}</label>}</div><p class="field-label">Faixa de renda</p><div class="audience-options">@for(option of incomeRanges();track option.id){<label><input type="checkbox" [checked]="incomeRangeIds().includes(option.id)" (change)="toggleAudienceOption('income',option.id)" />{{option.name}}</label>}</div><p class="field-label">Perfil psicográfico</p><div class="audience-options">@for(option of psychographicProfiles();track option.id){<label><input type="checkbox" [checked]="psychographicIds().includes(option.id)" (change)="toggleAudienceOption('profile',option.id)" />{{option.name}}</label>}</div> }
            @case ('investment') { <h2>Investimento</h2><p>Encontre peças pelo valor de referência.</p><div class="investment-range"><label for="map-min-price">Valor mínimo <span>R$</span><input id="map-min-price" type="number" inputmode="decimal" min="0" step="100" placeholder="Sem mínimo" [value]="minPrice() ?? ''" (input)="setPriceBound('min',$any($event.target).value)" /></label><span class="investment-range__divider" aria-hidden="true">até</span><label for="map-max-price">Valor máximo <span>R$</span><input id="map-max-price" type="number" inputmode="decimal" min="0" step="100" placeholder="Sem máximo" [value]="maxPrice() ?? ''" (input)="setPriceBound('max',$any($event.target).value)" /></label></div><label for="map-total-budget">Verba total para recomendação</label><input id="map-total-budget" type="number" inputmode="decimal" min="1" step="100" placeholder="Sugestão automática" [value]="totalBudget() ?? ''" (input)="setTotalBudget($any($event.target).value)" />@if(investmentError()){<p class="investment-error" role="alert">{{investmentError()}}</p>}<p>O preço final e a disponibilidade serão confirmados na cotação.</p> }
          }
          @if(activePanel!=='campaign'){<div class="popover-actions"><button type="button" (click)="clearActivePanel()">Limpar</button><button type="button" (click)="applyPanel()" [disabled]="activePanel==='investment' && !!investmentError()">Aplicar</button></div>}
        </div>
      }

      <div class="map-workspace">
        <aside class="map-results" [class.sheet-expanded]="sheetExpanded()" aria-label="Pontos encontrados">
          <div class="map-results__heading"><span>Peças recomendadas</span><strong>{{recommendedPoints().length}} de {{points().length}} pontos</strong><button type="button" class="sheet-toggle" (click)="sheetExpanded.update(value=>!value)">{{sheetExpanded()?'Ver mapa':'Ver lista'}}</button></div>
          <div class="recommendation-tabs" role="group" aria-label="Exibição da lista"><button type="button" [class.active]="listMode()==='recommended'" [attr.aria-pressed]="listMode()==='recommended'" (click)="setListMode('recommended')">Recomendadas</button><button type="button" [class.active]="listMode()==='all'" [attr.aria-pressed]="listMode()==='all'" (click)="setListMode('all')">Todas as peças</button></div>
          @if(sheetExpanded()) { <form class="mobile-filters" (submit)="search($event)"><label for="mobile-inventory-query">Buscar local</label><div><input id="mobile-inventory-query" type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Cidade, bairro ou avenida" /><button type="submit">Buscar</button></div><div class="mobile-filter-actions"><button type="button" (click)="togglePanel('campaign')">{{selectedCampaign()?.name || 'Campanha'}}</button><button type="button" (click)="filtersOpen.set(true)">Mais filtros ☷</button></div></form> }
          @if (loading()) { <p class="map-feedback" role="status">Buscando pontos…</p> }
          @else if (error()) { <p class="map-feedback" role="alert">{{error()}} <button type="button" (click)="load()">Tentar novamente</button></p> }
          @else if (!points().length) { <p class="map-feedback">Nenhum ponto corresponde à busca. Ajuste os filtros.</p> }
          @else if (!listPoints().length) { <p class="map-feedback">Nenhuma peça atende aos critérios de recomendação. Ajuste a verba ou o público, ou veja todas as peças.</p> }
          @else {
            @if (poiError()) { <p class="map-feedback" role="alert">{{poiError()}} <button type="button" (click)="load()">Tentar novamente</button></p> }
            <div class="map-results__list">
            @for (point of visiblePoints(); track point.id) {
              <article class="map-card" [class.selected]="selectedId()===point.id" (mouseenter)="highlight(point.id)" (mouseleave)="highlightedId.set(null)">
                <button class="map-card__media" type="button" (click)="select(point.id)" [attr.aria-label]="'Selecionar '+point.name">
                  @if (point.imageUrl) { <img [src]="point.imageUrl" [alt]="point.name" /> } @else { <span>Foto da peça</span> }
                  <b>{{point.mediaType || 'Mídia exterior'}}</b>
                </button>
                <div class="map-card__content"><h2>{{point.name}}</h2>@if(point.recommended){<span class="recommendation-chip">Recomendado para sua verba</span>}<p>⌖ {{point.address}}</p><div class="map-card__price"><span>Valor de referência</span><strong>{{point.price | currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong></div><button type="button" (click)="select(point.id)">Ver ponto →</button></div>
              </article>
            }
            </div>
          @if (pageCount() > 1) {
            <nav class="map-results__pagination" aria-label="Páginas do inventário">
              <button type="button" aria-label="Página anterior" [disabled]="page() === 1" (click)="setPage(page() - 1)">‹</button>
              <span>{{pageStart()}}–{{pageEnd()}} de {{listPoints().length}}</span>
              <button type="button" aria-label="Próxima página" [disabled]="page() === pageCount()" (click)="setPage(page() + 1)">›</button>
            </nav>
          }
          }
        </aside>
        <section class="map-canvas" aria-label="Mapa do inventário">
          <button class="mobile-map-search" type="button" (click)="sheetExpanded.set(true)"><strong>{{query() || 'Buscar peças'}}</strong><small>{{points().length}} {{points().length===1?'ponto encontrado':'pontos encontrados'}} · abrir lista</small></button>
          <div #mapCanvas class="google-map" [class.is-unavailable]="mapError()" aria-label="Mapa Google com os pontos do inventário"></div>
          @if (mapLoading()) { <div class="map-state" role="status">Carregando mapa…</div> }
          @if (mapError()) { <div class="map-state map-state--error" role="alert"><strong>Mapa indisponível</strong><span>{{mapError()}}</span></div> }
          @if (poiPlaces().length) { <div class="map-state map-state--poi" role="status">{{poiPlaces().length}} {{poiPlaces().length===1?'local de interesse destacado':'locais de interesse destacados'}} · peças até 5 km</div> }
          @if(recommendedPoints().length){<button class="map-recommendation-toggle" type="button" [attr.aria-pressed]="showRecommendedOnly()" (click)="toggleRecommendedOnMap()">{{showRecommendedOnly()?'Mostrar todos os locais':'Mostrar somente recomendados'}}</button>}
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
        <aside class="filter-drawer" aria-label="Mais filtros" role="dialog" aria-modal="true"><header><h2>Mais filtros</h2><button type="button" aria-label="Fechar filtros" (click)="filtersOpen.set(false)">×</button></header><div class="filter-drawer__body"><h3>Tipos de suporte</h3>@for(type of mediaTypes();track type){<label><input type="checkbox" [checked]="selectedMediaTypes().includes(type)" (change)="toggleMedia(type)" />{{type}}</label>}@if(!mediaTypes().length){<p>Os tipos serão exibidos após carregar o inventário.</p>}<hr/><h3>Próximos de (POI)</h3><label for="map-poi-query">Procurar nesta área por</label><input id="map-poi-query" type="search" [value]="poiQuery()" (input)="poiQuery.set($any($event.target).value)" placeholder="Ex.: hospital, aeroporto" />@for(category of poiCategories();track category.id){<label><input type="checkbox" [checked]="poiCategoryIds().includes(category.id)" (change)="togglePoiCategory(category.id)" />{{category.name}}</label>}@if(!poiCategories().length){<p>Não há categorias de interesse cadastradas.</p>}<p>Os locais encontrados serão destacados no mapa. Exibiremos peças até 5 km deles.</p></div><footer><button type="button" (click)="selectedMediaTypes.set([]); poiCategoryIds.set([]); poiQuery.set(''); filtersOpen.set(false); load()">Limpar</button><button type="button" (click)="filtersOpen.set(false); load()">Refinar</button></footer></aside>
      }
    </div>
  `,
})
export class AurumMapPage implements AfterViewInit {
  @ViewChild('mapCanvas') private mapCanvas?: ElementRef<HTMLElement>;
  private readonly inventory = inject(InventoryService);
  readonly auth = inject(AdvertiserAuthService);
  readonly campaignSelection = inject(CampaignSelectionService);
  private readonly checkout = inject(CheckoutService);
  private readonly mapsLoader = inject(GoogleMapsLoaderService);
  readonly cart = inject(CartService);
  private readonly cartDrawer = inject(CartDrawerService);
  private maps: any;
  private map: any;
  private markers: any[] = [];
  private readonly markersById = new Map<number, any>();
  private poiMarkers: any[] = [];
  private requestVersion = 0;
  private viewReady = false;
  readonly points = signal<InventoryPoint[]>([]);
  readonly recommendedPoints = computed(() => recommendationList(this.points(), true));
  readonly listMode = signal<'recommended' | 'all'>('recommended');
  readonly showRecommendedOnly = signal(false);
  readonly listPoints = computed(() => recommendationList(this.points(), this.listMode() === 'recommended'));
  readonly mapPoints = computed(() => recommendationList(this.points(), this.showRecommendedOnly()));
  readonly pageSize = 10;
  readonly page = signal(1);
  readonly pageCount = computed(() => pageCount(this.listPoints().length, this.pageSize));
  readonly pageStart = computed(() => (this.page() - 1) * this.pageSize + 1);
  readonly pageEnd = computed(() => Math.min(this.page() * this.pageSize, this.listPoints().length));
  readonly visiblePoints = computed(() => pageItems(this.listPoints(), this.page(), this.pageSize));
  readonly mediaTypes = signal<string[]>([]);
  readonly cities = signal<Array<{name:string;state:string}>>([]);
  readonly city = signal('');
  readonly ageRanges = signal<Array<{id:number;name:string}>>([]);
  readonly incomeRanges = signal<Array<{id:number;name:string}>>([]);
  readonly psychographicProfiles = signal<Array<{id:number;name:string}>>([]);
  readonly poiCategories = signal<Array<{id:number;name:string}>>([]);
  readonly gender = signal(0);
  readonly ageRangeIds = signal<number[]>([]);
  readonly incomeRangeIds = signal<number[]>([]);
  readonly psychographicIds = signal<number[]>([]);
  readonly poiCategoryIds = signal<number[]>([]);
  readonly poiQuery = signal('');
  readonly poiPlaces = signal<PoiPlace[]>([]);
  readonly poiError = signal('');
  readonly audienceActive = computed(() => this.gender()>0 || this.ageRangeIds().length>0 || this.incomeRangeIds().length>0 || this.psychographicIds().length>0);
  readonly periods = signal<Array<{code:string;name:string;periodicity:string;startDate:string;endDate:string}>>([]);
  readonly selectedPeriod = computed(() => this.periods().find(p => p.code === this.campaignSelection.periodCode()) ?? null);
  readonly visiblePeriods = computed(() => this.periods().filter(p => p.periodicity === this.periodicity()));
  readonly campaigns = signal<CheckoutCampaign[]>([]);
  readonly agencyClients = signal<Array<{id:number;name:string}> | null>(null);
  readonly selectedCampaign = computed(() => this.campaigns().find(c => c.id === this.campaignSelection.campaignId()) ?? null);
  readonly creatingCampaign = signal(false);
  readonly campaignBusy = signal(false);
  readonly campaignError = signal('');
  readonly newCampaignName = signal('');
  readonly newCampaignProduct = signal('');
  readonly newCampaignJob = signal('');
  readonly newCampaignStart = signal('');
  readonly newCampaignEnd = signal('');
  readonly newCampaignBudget = signal(0);
  readonly newCampaignClientId = signal<number | null>(null);
  readonly selectedMediaTypes = signal<string[]>([]);
  readonly query = signal('');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly totalBudget = signal<number | null>(null);
  readonly investmentLabel = computed(() => {
    const min = this.minPrice(), max = this.maxPrice();
    const money = (value: number) => `R$ ${value.toLocaleString('pt-BR')}`;
    if (min !== null && max !== null) return `${money(min)} a ${money(max)}`;
    if (min !== null) return `A partir de ${money(min)}`;
    if (max !== null) return `Até ${money(max)}`;
    return 'Qualquer valor';
  });
  readonly investmentError = computed(() => this.minPrice() !== null && this.maxPrice() !== null && this.minPrice()! > this.maxPrice()! ? 'O valor mínimo deve ser menor ou igual ao máximo.' : '');
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

  constructor() {
    this.inventory.filters().subscribe({ next: filters => { this.mediaTypes.set(filters.mediaTypes); this.cities.set(filters.cities); this.periods.set(filters.periods); this.ageRanges.set(filters.audience.ageRanges); this.incomeRanges.set(filters.audience.incomeRanges); this.psychographicProfiles.set(filters.audience.psychographicProfiles); this.poiCategories.set(filters.audience.poiCategories ?? []); } });
    effect(() => { if (this.auth.user()?.kycStatus === 'approved') this.loadCampaigns(); });
    this.load();
  }
  ngAfterViewInit() { this.viewReady = true; void this.renderMap(); }
  @HostListener('document:keydown.escape') onEscape() { this.panel.set(null); this.filtersOpen.set(false); this.selectedId.set(null); }
  togglePanel(value: Exclude<FilterPanel, null>) { this.filtersOpen.set(false); this.panel.update(current => current === value ? null : value); }
  clearActivePanel() { if(this.panel()==='where'){this.query.set('');this.city.set('');} if(this.panel()==='when') this.campaignSelection.periodCode.set(''); if(this.panel()==='audience'){this.gender.set(0);this.ageRangeIds.set([]);this.incomeRangeIds.set([]);this.psychographicIds.set([]);} if(this.panel()==='investment'){this.minPrice.set(null);this.maxPrice.set(null);this.totalBudget.set(null);} this.panel.set(null); this.load(); }
  applyPanel() { if(this.panel()==='investment' && this.investmentError()) return; this.panel.set(null); this.load(); }
  setPriceBound(bound: 'min'|'max', raw: string) { const parsed=raw.trim()===''?null:Number(raw); const value=parsed===null||!Number.isFinite(parsed)?null:Math.max(0,parsed); (bound==='min'?this.minPrice:this.maxPrice).set(value); }
  setTotalBudget(raw: string) { const value = Number(raw); this.totalBudget.set(raw.trim() && Number.isFinite(value) && value > 0 ? value : null); }
  search(event: Event) { event.preventDefault(); this.panel.set(null); this.load(); }
  setPage(page: number) { this.page.set(clampPage(page, this.listPoints().length, this.pageSize)); }
  setListMode(mode: 'recommended' | 'all') { this.listMode.set(mode); this.page.set(1); }
  toggleRecommendedOnMap() { this.showRecommendedOnly.update(value => !value); void this.renderMap(); }
  toggleMedia(type: string) { this.selectedMediaTypes.update(current => current.includes(type) ? current.filter(value => value!==type) : [...current,type]); }
  togglePoiCategory(id: number) { this.poiCategoryIds.update(current => current.includes(id) ? current.filter(value => value!==id) : [...current,id]); }
  choosePeriodicity(period: string) { this.periodicity.set(period); this.campaignSelection.periodCode.set(''); }
  toggleAudienceOption(kind: 'age'|'income'|'profile', id: number) {
    const target=kind==='age'?this.ageRangeIds:kind==='income'?this.incomeRangeIds:this.psychographicIds;
    target.update(values=>values.includes(id)?values.filter(value=>value!==id):[...values,id]);
  }
  selectCampaign(raw: string) { const id=Number(raw); this.campaignSelection.selectCampaign(Number.isInteger(id)&&id>0?id:null); }
  private loadCampaigns() { this.checkout.context().subscribe({next: context => { this.campaigns.set(context.campaigns); this.agencyClients.set(context.clients ?? null); }, error: () => this.campaignError.set('Não foi possível carregar suas campanhas.')}); }
  createCampaign() {
    if(this.campaignBusy())return;
    const name=this.newCampaignName().trim(), product=this.newCampaignProduct().trim(), startDate=this.newCampaignStart(), endDate=this.newCampaignEnd();
    if(name.length<3||product.length<2||!startDate||!endDate||endDate<startDate){this.campaignError.set('Informe nome, produto e datas válidas.');return;}
    if(this.agencyClients() !== null && !this.newCampaignClientId()){this.campaignError.set('Selecione o anunciante representado.');return;}
    this.campaignBusy.set(true);this.campaignError.set('');
    this.checkout.createCampaign({name,product,job:this.newCampaignJob().trim(),startDate,endDate,budget:this.newCampaignBudget(),...(this.newCampaignClientId()?{clientId:this.newCampaignClientId()!}:{})}).pipe(finalize(()=>this.campaignBusy.set(false))).subscribe({
      next: campaign => { this.campaignSelection.selectCampaign(campaign.id); this.creatingCampaign.set(false); this.panel.set(null); this.loadCampaigns(); },
      error: () => this.campaignError.set('Não foi possível criar a campanha. Confira o cadastro comercial e tente novamente.'),
    });
  }
  addToCart(point: InventoryPoint) { this.cart.add(point); this.cartDrawer.open.set(true); }
  highlight(id: number) { this.highlightedId.set(id); this.updatePieceIcons(); }
  select(id: number) { this.selectedId.set(id); this.updatePieceIcons(); this.sheetExpanded.set(false); if(!this.listPoints().some(point=>point.id===id)) this.listMode.set('all'); const index=this.listPoints().findIndex(item=>item.id===id); if(index>=0) this.page.set(Math.floor(index/this.pageSize)+1); const point=this.points().find(item=>item.id===id); if(point&&this.map){this.map.panTo({lat:point.latitude,lng:point.longitude});this.map.setZoom(15);setTimeout(()=>{if(this.selectedId()===id){const width=this.mapCanvas?.nativeElement.clientWidth??0;this.map.panBy(width>760?Math.min(200,width*.19):0,width>760?-65:145);}},120);} }
  load() {
    const version = ++this.requestVersion;
    this.loading.set(true); this.error.set(''); this.poiError.set('');
    this.inventory.search({query:this.query(),city:this.city(),minPrice:this.minPrice()??undefined,maxPrice:this.maxPrice()??undefined,totalBudget:this.totalBudget()??undefined,periodCode:this.campaignSelection.periodCode()||undefined,gender:this.gender()||undefined,ageRangeIds:this.ageRangeIds().join(','),incomeRangeIds:this.incomeRangeIds().join(','),psychographicIds:this.psychographicIds().join(','),poiCategoryIds:this.poiCategoryIds().join(',')}).subscribe({
      next: all => { void this.applyResults(all, version); },
      error:()=>{if(version===this.requestVersion){this.error.set('Não foi possível carregar o inventário.');this.loading.set(false);}},
    });
  }
  private async applyResults(all: InventoryPoint[], version: number) {
    const chosen = this.selectedMediaTypes();
    let points = chosen.length ? all.filter(point => chosen.includes(point.mediaType)) : all;
    const categoryNames = this.poiCategories().filter(category => this.poiCategoryIds().includes(category.id)).map(category => category.name);
    if (this.poiQuery().trim()) categoryNames.push(this.poiQuery().trim());
    if (categoryNames.length) {
      try {
        const places = await this.searchPoiPlaces(categoryNames);
        if (version !== this.requestVersion) return;
        this.poiPlaces.set(places);
        points = points.filter(point => places.some(place => distanceMeters(point, place) <= POI_RADIUS_METERS));
      } catch {
        if (version !== this.requestVersion) return;
        this.poiPlaces.set([]);
        this.poiError.set('Não foi possível buscar os locais de interesse no Google Maps. As peças continuam sem filtro de proximidade.');
      }
    } else this.poiPlaces.set([]);
    if (version !== this.requestVersion) return;
    this.points.set(points);
    this.showRecommendedOnly.set(false);
    this.listMode.set('recommended');
    this.page.set(1);
    if (this.selectedId() && !points.some(point => point.id === this.selectedId())) this.selectedId.set(null);
    void this.renderMap();
    this.loading.set(false);
  }
  private async searchPoiPlaces(categories: string[]): Promise<PoiPlace[]> {
    const maps = await this.mapsLoader.load();
    const { PlacesService, PlacesServiceStatus } = await maps.importLibrary('places');
    if (!this.map && !this.mapCanvas) throw new Error('Map canvas is not ready');
    const service = new PlacesService(this.map ?? this.mapCanvas!.nativeElement);
    const results = await Promise.all(categories.map(category => new Promise<PoiPlace[]>((resolve, reject) => {
      const bounds = this.map?.getBounds();
      const request = bounds
        ? { query: `${category} ${this.city()}`.trim(), bounds }
        : { query: `${category} ${this.city()}`.trim(), location: new maps.LatLng(-23.5614, -46.6559), radius: 50000 };
      service.textSearch(request, (places: any[] | null, status: string) => {
        if (status === PlacesServiceStatus.ZERO_RESULTS) { resolve([]); return; }
        if (status !== PlacesServiceStatus.OK) { reject(new Error(`Places search failed: ${status}`)); return; }
        resolve((places ?? []).filter(place => place.geometry?.location).slice(0, 20).map(place => ({
          name: place.name || category,
          category,
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
        })));
      });
    })));
    return results.flat().filter((place, index, all) => all.findIndex(other => other.latitude === place.latitude && other.longitude === place.longitude) === index);
  }
  private pieceIcon(point: InventoryPoint): object {
    const active = this.selectedId() === point.id || this.highlightedId() === point.id;
    return { url: `/assets/pins/tipo-suporte/${supportIcon(point.mediaType)}`, scaledSize: new this.maps.Size(active ? 50 : 37, active ? 62 : 46) };
  }
  private updatePieceIcons() {
    for (const point of this.points()) this.markersById.get(point.id)?.setIcon(this.pieceIcon(point));
  }
  private async renderMap() {
    if(!this.viewReady||!this.mapCanvas)return;
    this.mapLoading.set(true); this.mapError.set('');
    try {
      this.maps??=await this.mapsLoader.load();
      if(!this.map) this.map=new this.maps.Map(this.mapCanvas.nativeElement,{center:{lat:-23.5614,lng:-46.6559},zoom:12,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,clickableIcons:false,gestureHandling:'cooperative'});
      this.markers.forEach(marker=>marker.setMap(null));this.markers=[];this.markersById.clear();
      this.poiMarkers.forEach(marker=>marker.setMap(null));this.poiMarkers=[];
      const bounds=new this.maps.LatLngBounds();
      this.mapPoints().forEach(point=>{
        if(!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude))return;
        const marker=new this.maps.Marker({map:this.map,position:{lat:point.latitude,lng:point.longitude},title:point.name,icon:this.pieceIcon(point),opacity:point.recommended ? 1 : 0.5,zIndex:point.recommended ? 200 : 100});
        marker.addListener('click',()=>this.select(point.id));this.markers.push(marker);this.markersById.set(point.id,marker);bounds.extend(marker.getPosition());
      });
      for(const place of this.poiPlaces()) {
        const category = place.category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const iconText = category.includes('hospital') ? 'H' : category.includes('aeroporto') ? '✈' : place.category.charAt(0).toUpperCase();
        const marker = new this.maps.Marker({map:this.map,position:{lat:place.latitude,lng:place.longitude},title:`${place.category}: ${place.name}`,label:{text:iconText,color:'#fff',fontSize:'15px',fontWeight:'700'},icon:{path:this.maps.SymbolPath.CIRCLE,scale:16,fillColor:category.includes('hospital')?'#d93025':'#1a73e8',fillOpacity:1,strokeColor:'#fff',strokeWeight:3},zIndex:3000});
        this.poiMarkers.push(marker);bounds.extend(marker.getPosition());
      }
      const totalMarkers=this.markers.length+this.poiMarkers.length;
      if(totalMarkers===1){this.map.setCenter(bounds.getCenter());this.map.setZoom(14);}else if(totalMarkers>1)this.map.fitBounds(bounds,76);
    }catch(error){this.mapError.set(error instanceof Error?error.message:'Não foi possível carregar o Google Maps.');}
    finally{this.mapLoading.set(false);}
  }
}
