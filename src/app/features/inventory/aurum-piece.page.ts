import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { InventoryPoint } from '../../core/api/app-api.models';
import { CartDrawerService } from '../../core/cart/cart-drawer.service';
import { CartService } from '../../core/cart/cart.service';
import { InventoryService } from '../../core/inventory/inventory.service';
import { GoogleMapsLoaderService } from '../../core/maps/google-maps-loader.service';

@Component({
  imports: [CurrencyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="aurum-piece">
      <a class="back-link" routerLink="/mapa">← Voltar ao mapa</a>
      @if(error()){<div class="piece-error" role="alert">{{error()}} <a routerLink="/mapa">Explorar outras peças</a></div>}
      @else if(point();as piece){
        <div class="piece-hero">
          <div class="piece-photo">
            @if(piece.imageUrl){<img [src]="piece.imageUrl" [alt]="piece.name" />}@else{<div class="missing-photo"><span>Foto da peça ainda não fornecida pelo inventário</span></div>}
            <span class="piece-media-chip">{{piece.mediaType}}</span>
          </div>
          <div class="piece-streetview" #streetView aria-label="Street View ou mapa da localização">@if(visualLoading()){<span>Carregando localização…</span>}</div>
        </div>
        <div class="piece-body">
          <div class="piece-main">
            <div class="piece-heading"><h1>{{piece.name}}</h1><p>{{piece.address}} · {{piece.city}}, {{piece.state}} · Código {{piece.code}}</p>@if(piece.rating && piece.ratingCount){<p class="piece-rating"><span aria-hidden="true">★★★★★</span> {{piece.rating.toLocaleString('pt-BR')}} · {{piece.ratingCount}} {{piece.ratingCount===1?'avaliação':'avaliações'}}</p>}@else{<p class="piece-rating">Ainda sem avaliações</p>}</div>
            <section class="facts-card"><h2>Características da peça</h2><div class="fact-grid"><div><img class="fact-icon" src="/assets/figma/piece-facts/illumination.png" alt="" /><strong>{{piece.illuminated?'Iluminada':'Não iluminada'}}</strong><small>Iluminação</small></div><div><img class="fact-icon" src="/assets/figma/piece-facts/view-angle.png" alt="" /><strong>{{piece.viewAngle ? piece.viewAngle+'°' : 'Não informado'}}</strong><small>Ângulo de visão</small></div><div><img class="fact-icon" src="/assets/figma/piece-facts/permit.png" alt="" /><strong>{{piece.permit===true?'Válido':piece.permit===false?'Não informado':'Não informado'}}</strong><small>Alvará</small></div></div></section>
            <section class="facts-card"><h2>Características do local</h2><h3>Contexto viário</h3><div class="fact-grid"><div><img class="fact-icon" src="/assets/figma/piece-facts/lanes.png" alt="" /><strong>{{piece.road?.lanes ? piece.road?.lanes+' faixas' : 'Não informado'}}</strong><small>Faixas da via</small></div><div><img class="fact-icon" src="/assets/figma/piece-facts/speed.png" alt="" /><strong>{{piece.road?.speed ? piece.road?.speed+' km/h' : 'Não informado'}}</strong><small>Velocidade da via</small></div><div><img class="fact-icon" src="/assets/figma/piece-facts/traffic-light.png" alt="" /><strong>{{piece.trafficLight?'Próximo':'Não informado'}}</strong><small>Semáforo</small></div><div><img class="fact-icon" src="/assets/figma/piece-facts/pedestrians.png" alt="" /><strong>{{piece.road?.pedestrians || 'Não informado'}}</strong><small>Fluxo de pedestres</small></div></div></section>
          </div>
          <aside class="piece-purchase" aria-label="Comprar peça"><small>Periodicidade</small><div class="period-label">{{piece.periodicity || 'Período a confirmar na cotação'}}</div>@if(piece.tablePrice && piece.tablePrice>piece.price){<span class="table-price">Valor tabela {{piece.tablePrice | currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</span>}<span class="reference-label">Veiculação · valor de referência</span><strong class="piece-price">{{piece.price | currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong><div class="piece-price-facts"><span>CPM</span><strong>{{piece.cpm ? (piece.cpm | currency:'BRL':'symbol':'1.2-2':'pt-BR') : 'A confirmar'}}</strong></div><p>A disponibilidade e o preço final serão validados antes do pedido.</p><button type="button" (click)="add(piece)" [disabled]="!piece.available">{{cart.contains(piece.id)?'Ver no carrinho':'Adicionar ao carrinho'}}</button><small class="piece-status">{{piece.available?'✓ Peça publicada no catálogo':'Peça indisponível'}}</small></aside>
        </div>
      }@else{<p class="piece-loading" role="status">Carregando peça…</p>}
    </main>
  `,
})
export class AurumPiecePage {
  @ViewChild('streetView') private streetView?: ElementRef<HTMLElement>;
  private readonly route=inject(ActivatedRoute);
  private readonly inventory=inject(InventoryService);
  private readonly mapsLoader=inject(GoogleMapsLoaderService);
  private readonly drawer=inject(CartDrawerService);
  readonly cart=inject(CartService);
  readonly point=signal<InventoryPoint|null>(null);
  readonly error=signal('');
  readonly visualLoading=signal(true);

  constructor(){
    const code=this.route.snapshot.paramMap.get('codigo')??'';
    this.inventory.getByCode(code).subscribe({next:piece=>{this.point.set(piece);setTimeout(()=>void this.renderLocation(piece));},error:()=>this.error.set('Esta peça não foi encontrada.')});
  }
  add(piece:InventoryPoint){if(!piece.available)return;this.cart.add(piece);this.drawer.open.set(true);}
  private async renderLocation(piece:InventoryPoint){
    if(!this.streetView)return;
    try{
      const maps=await this.mapsLoader.load();
      const position={lat:piece.latitude,lng:piece.longitude};
      if(!Number.isFinite(position.lat)||!Number.isFinite(position.lng))throw new Error('Sem coordenadas');
      try{
        const panorama=await new maps.StreetViewService().getPanorama({location:position,radius:80});
        if(panorama.status==='OK'){
          new maps.StreetViewPanorama(this.streetView.nativeElement,{position,pov:{heading:0,pitch:0},addressControl:false,fullscreenControl:false,motionTracking:false});
          return;
        }
      }catch{/* Sem panorama: o mapa é o fallback requerido pelo PRD. */}
      const map=new maps.Map(this.streetView.nativeElement,{center:position,zoom:15,mapTypeControl:false,streetViewControl:false,fullscreenControl:false});
      new maps.Marker({map,position,title:piece.name});
    }catch{this.streetView.nativeElement.textContent='Localização indisponível';}
    finally{this.visualLoading.set(false);}
  }
}
