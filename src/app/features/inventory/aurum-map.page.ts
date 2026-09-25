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
import { GoogleMapsLoaderService } from '../../core/maps/google-maps-loader.service';

type FilterPanel = 'campaign' | 'where' | 'when' | 'audience' | 'investment' | null;

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
        <button class="map-toolbar__field" type="button" [class.active]="panel()==='investment'" (click)="togglePanel('investment')"><small>Investimento</small><strong>{{totalBudget() ? 'Até ' + (totalBudget() | currency:'BRL':'symbol':'1.0-0':'pt-BR') : 'Qualquer valor'}}</strong></button>
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
            @case ('investment') { <h2>Investimento</h2><label for="map-total-budget">Verba total para recomendar pontos</label><select id="map-total-budget" [value]="totalBudget() ?? ''" (change)="totalBudget.set($any($event.target).value ? +$any($event.target).value : null)"><option value="">Qualquer valor</option><option value="5000">Até R$ 5 mil</option><option value="10000">Até R$ 10 mil</option><option value="20000">Até R$ 20 mil</option><option value="30000">Até R$ 30 mil</option></select><p>Os pontos recomendados cabem na verba estimada. O preço final é confirmado na cotação.</p> }
          }
          @if(activePanel!=='campaign'){<div class="popover-actions"><button type="button" (click)="clearActivePanel()">Limpar</button><button type="button" (click)="applyPanel()">Aplicar</button></div>}
        </div>
      }

      <div class="map-workspace">
        <aside class="map-results" [class.sheet-expanded]="sheetExpanded()" aria-label="Pontos encontrados">
          <div class="map-results__heading"><span>Inventário</span><strong>{{points().length}} {{points().length===1?'ponto encontrado':'pontos encontrados'}}</strong><button type="button" class="sheet-toggle" (click)="sheetExpanded.update(value=>!value)">{{sheetExpanded()?'Ver mapa':'Ver lista'}}</button></div>
          @if(sheetExpanded()) { <form class="mobile-filters" (submit)="search($event)"><label for="mobile-inventory-query">Buscar local</label><div><input id="mobile-inventory-query" type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Cidade, bairro ou avenida" /><button type="submit">Buscar</button></div><div class="mobile-filter-actions"><button type="button" (click)="togglePanel('campaign')">{{selectedCampaign()?.name || 'Campanha'}}</button><button type="button" (click)="filtersOpen.set(true)">Mais filtros ☷</button></div></form> }
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
                <div class="map-card__content"><h2>{{point.name}}</h2>@if(point.recommended){<span class="recommendation-chip">Recomendado para sua verba</span>}<p>⌖ {{point.address}}</p><div class="map-card__price"><span>Valor de referência</span><strong>{{point.price | currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong></div><button type="button" (click)="select(point.id)">Ver ponto →</button></div>
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
        <aside class="filter-drawer" aria-label="Mais filtros" role="dialog" aria-modal="true"><header><h2>Mais filtros</h2><button type="button" aria-label="Fechar filtros" (click)="filtersOpen.set(false)">×</button></header><div class="filter-drawer__body"><h3>Tipos de suporte</h3>@for(type of mediaTypes();track type){<label><input type="checkbox" [checked]="selectedMediaTypes().includes(type)" (change)="toggleMedia(type)" />{{type}}</label>}@if(!mediaTypes().length){<p>Os tipos serão exibidos após carregar o inventário.</p>}<hr/><h3>Interesses próximos (POI)</h3>@for(category of poiCategories();track category.id){<label><input type="checkbox" [checked]="poiCategoryIds().includes(category.id)" (change)="togglePoiCategory(category.id)" />{{category.name}}</label>}@if(!poiCategories().length){<p>Não há categorias de interesse cadastradas.</p>}<p>Essas categorias priorizam locais com o público correspondente.</p></div><footer><button type="button" (click)="selectedMediaTypes.set([]); poiCategoryIds.set([]); filtersOpen.set(false); load()">Limpar</button><button type="button" (click)="filtersOpen.set(false); load()">Refinar</button></footer></aside>
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
  private viewReady = false;
  readonly points = signal<InventoryPoint[]>([]);
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
  readonly totalBudget = signal<number | null>(null);
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
  clearActivePanel() { if(this.panel()==='where'){this.query.set('');this.city.set('');} if(this.panel()==='when') this.campaignSelection.periodCode.set(''); if(this.panel()==='audience'){this.gender.set(0);this.ageRangeIds.set([]);this.incomeRangeIds.set([]);this.psychographicIds.set([]);} if(this.panel()==='investment') this.totalBudget.set(null); this.panel.set(null); this.load(); }
  applyPanel() { this.panel.set(null); this.load(); }
  search(event: Event) { event.preventDefault(); this.panel.set(null); this.load(); }
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
  highlight(id: number) { this.highlightedId.set(id); }
  select(id: number) { this.selectedId.set(id); this.sheetExpanded.set(false); const point=this.points().find(item=>item.id===id); if(point&&this.map){this.map.panTo({lat:point.latitude,lng:point.longitude});this.map.setZoom(15);} }
  load() {
    this.loading.set(true); this.error.set('');
    this.inventory.search({query:this.query(),city:this.city(),totalBudget:this.totalBudget()??undefined,periodCode:this.campaignSelection.periodCode()||undefined,gender:this.gender()||undefined,ageRangeIds:this.ageRangeIds().join(','),incomeRangeIds:this.incomeRangeIds().join(','),psychographicIds:this.psychographicIds().join(','),poiCategoryIds:this.poiCategoryIds().join(',')}).pipe(finalize(()=>this.loading.set(false))).subscribe({
      next: all => {
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
