import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CheckoutQuote, OrderConfirmation } from '../../core/api/app-api.models';
import { AdvertiserAuthService } from '../../core/auth/advertiser-auth.service';
import { CartService } from '../../core/cart/cart.service';
import { CheckoutService } from '../../core/checkout/checkout.service';
import { environment } from '../../../environments/environment';

@Component({imports:[CurrencyPipe,DatePipe,RouterLink],changeDetection:ChangeDetectionStrategy.OnPush,template:`
  <div class="checkout-page"><div class="checkout-head"><a routerLink="/mapa">← Continuar explorando</a><p class="step">Revisão do pedido</p><h1>Seu carrinho</h1><p>Confira as peças antes de solicitar a compra.</p></div>
  @if(prototype){<p class="prototype-banner" role="note">Modo de protótipo: preços e pedido são ilustrativos. Nenhuma compra real será registrada.</p>}
  @if(!cart.count()){<section class="empty-cart"><span>▱</span><h2>Seu carrinho está vazio</h2><p>Explore o mapa e selecione as peças que deseja anunciar.</p><a class="action" routerLink="/mapa">Explorar peças</a></section>}
  @else{<div class="checkout-layout"><section class="checkout-items" aria-label="Itens do carrinho"><div class="section-header"><h2>Peças selecionadas</h2><span>{{cart.count()}} {{cart.count()===1?'peça':'peças'}}</span></div>
  @for(item of cart.items();track item.id){<article class="checkout-item"><div class="item-visual">▣</div><div class="item-main"><a [routerLink]="['/pecas',item.code]">{{item.name}}</a><p>{{item.address}} · {{item.city}}</p><small>{{item.mediaType}} · {{item.format}}</small></div><div class="item-actions"><strong>{{item.price|currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong><button type="button" (click)="remove(item.id)">Remover</button></div></article>}
  <div class="checkout-disclaimer"><strong>Como funciona</strong><p>Esta ação solicita a compra, não efetiva uma reserva automática. A disponibilidade e o valor final serão confirmados antes do envio.</p></div></section>
  <aside class="order-summary"><h2>Resumo</h2><div class="summary-line"><span>{{cart.count()}} {{cart.count()===1?'peça':'peças'}}</span><strong>{{cart.subtotal()|currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong></div><p>O valor exibido é uma estimativa. No fluxo real, o servidor calcula a cotação final.</p>@if(!prototype&&!auth.user()){<p role="status">Você pode revisar o carrinho sem entrar. Para consultar a cotação, faça login.</p>}<button class="quote-button" (click)="getQuote()" [disabled]="loading()">{{loading()?'Consultando…':!prototype&&!auth.user()?'Entrar para consultar':'Conferir valor e disponibilidade'}}</button>
  @if(error()){<p class="error" role="alert">{{error()}}</p>}
  @if(quote();as currentQuote){<div class="quote-result"><span>{{currentQuote.prototype?'Cotação de demonstração':'Cotação confirmada'}}</span><strong>{{currentQuote.total|currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong><small>Válida até {{currentQuote.expiresAt|date:'shortTime'}}</small></div><label class="terms"><input type="checkbox" [checked]="accepted()" (change)="accepted.set($any($event.target).checked)" /><span>Li e aceito os termos de uso, a política de cancelamento e as condições comerciais.</span></label><button class="action" (click)="placeOrder()" [disabled]="!accepted()||loading()||!canSubmit()">{{loading()?'Enviando…':prototype?'Simular pedido':'Fechar pedido'}}</button>@if(!canSubmit()&&!prototype){<p class="blocked">Seu cadastro precisa ser aprovado para fechar o pedido.</p>}}</aside></div>}
  </div>`})
export class CheckoutPage {
  readonly cart=inject(CartService);
  private readonly checkout=inject(CheckoutService);
  readonly auth=inject(AdvertiserAuthService);
  private readonly router=inject(Router);
  readonly prototype=environment.usePrototypeFixtures;
  readonly quote=signal<CheckoutQuote|null>(null);
  readonly loading=signal(false);readonly accepted=signal(false);readonly error=signal('');
  private readonly idempotencyKey=crypto.randomUUID();
  constructor(){if(!this.prototype&&!this.auth.user()){this.auth.loadMe().subscribe({error:()=>this.auth.logout()});}}
  canSubmit(){return this.prototype||this.auth.user()?.kycStatus==='approved';}
  remove(id:number){this.cart.remove(id);this.quote.set(null);this.accepted.set(false);}
  getQuote(){
    if(this.loading()||!this.cart.count())return;
    if(!this.prototype&&!this.auth.user()){
      void this.router.navigate(['/login'],{queryParams:{returnUrl:'/checkout'}});return;
    }
    if(!this.prototype&&this.auth.user()?.kycStatus!=='approved'){
      void this.router.navigate(['/kyc-status']);return;
    }
    const ids=this.cart.items().map(item=>item.id).join(',');
    this.quote.set(null);this.accepted.set(false);this.loading.set(true);this.error.set('');
    this.checkout.quote(this.cart.items()).pipe(finalize(()=>this.loading.set(false))).subscribe({
      next:q=>{if(ids===this.cart.items().map(item=>item.id).join(','))this.quote.set(q);},
      error:()=>this.error.set('Não foi possível confirmar preço e disponibilidade. Tente novamente.')
    });
  }
  placeOrder(){
    const quote=this.quote();
    if(!quote||!this.accepted()||!this.canSubmit()||this.loading()||!this.cart.count())return;
    if(Date.parse(quote.expiresAt)<=Date.now()){this.quote.set(null);this.error.set('A cotação expirou. Confira o valor e a disponibilidade novamente.');return;}
    this.loading.set(true);this.error.set('');
    this.checkout.placeOrder(quote,this.idempotencyKey).pipe(finalize(()=>this.loading.set(false))).subscribe({
      next:(order:OrderConfirmation)=>{this.cart.clear();void this.router.navigate(['/pedidos/sucesso'],{state:{order}});},
      error:()=>this.error.set('Não foi possível enviar o pedido. Tente novamente sem fechar a página.')
    });
  }
}
