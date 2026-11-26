import { CurrencyPipe, UpperCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CheckoutContext, CheckoutQuote, InventoryPoint, OrderConfirmation } from '../../core/api/app-api.models';
import { AdvertiserAuthService } from '../../core/auth/advertiser-auth.service';
import { CartService } from '../../core/cart/cart.service';
import { CampaignSelectionService } from '../../core/checkout/campaign-selection.service';
import { CheckoutService } from '../../core/checkout/checkout.service';
import { FotosIndisponiveis } from '../../core/inventory/fotos-indisponiveis';
import { environment } from '../../../environments/environment';

@Component({
  imports: [CurrencyPipe, UpperCasePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="checkout-overlay">
      <div class="checkout-overlay__backdrop" aria-hidden="true"></div>
      <main class="checkout-drawer" aria-label="Checkout do carrinho">
        <header class="checkout-drawer__head"><h1>♧ Checkout <span>{{cart.count()}} {{cart.count()===1?'peça':'peças'}}</span></h1><a routerLink="/mapa" aria-label="Fechar checkout">×</a></header>
        @if(!cart.count()){
          <div class="checkout-empty"><h2>Seu carrinho está vazio</h2><p>Explore o mapa e adicione peças para revisar aqui.</p><a routerLink="/mapa">Explorar peças</a></div>
        }@else{
          <section class="checkout-campaign" aria-label="Campanha"><h2>Campanha</h2>
            @if(context()?.campaigns?.length){<div class="checkout-campaign__fields"><label>Selecione a campanha<select [value]="campaignId() ?? ''" (change)="selectCampaign($any($event.target).value)"><option value="">Escolha uma campanha</option>@for(campaign of context()!.campaigns;track campaign.id){<option [value]="campaign.id" [selected]="campaign.id===campaignId()">{{campaign.name}}</option>}</select></label><label>Período<select [value]="periodCode()" (change)="selectPeriod($any($event.target).value)" [disabled]="!campaignId()"><option value="">Escolha um período</option>@for(period of periods();track period.codigo){<option [value]="period.codigo" [selected]="period.codigo===periodCode()">{{period.nome}}</option>}</select></label></div>}
            @else if(context()){<div class="campaign-required">Você ainda não tem campanha com período futuro. Crie uma abaixo para cotar e fechar o pedido.</div>}
            @else{<div class="campaign-required">@if(!auth.user()&&!prototype){Você pode revisar o carrinho sem login. Entre para selecionar uma campanha.}@else if(auth.user()&&auth.user()!.kycStatus!=='approved'){Seu cadastro precisa estar aprovado para criar ou selecionar uma campanha.}@else if(contextFailed()){Não foi possível carregar suas campanhas. <button class="campaign-retry" type="button" (click)="loadContext()">Tentar de novo</button>}@else{Carregando campanhas…}</div>}
            @if(campaignId()&&!periods().length){<div class="campaign-required">Esta campanha não tem período comercial disponível nas datas previstas. Crie outra campanha com datas futuras.</div>}
            @if(context()){<button class="campaign-create-toggle" type="button" (click)="creatingCampaign.update(v=>!v)">{{creatingCampaign()?'Cancelar criação':'+ Criar campanha'}}</button>
              @if(creatingCampaign()){<div class="checkout-campaign__fields">@if(context()!.clients;as clients){@if(!clients.length){<p class="checkout-error">Nenhum anunciante liberado para esta conta. Solicite o vínculo antes de criar a campanha.</p>}<label>Anunciante representado<select [value]="newClientId() ?? ''" (change)="newClientId.set(+$any($event.target).value || null)"><option value="">Selecione o anunciante</option>@for(client of clients;track client.id){<option [value]="client.id">{{client.name}}</option>}</select></label>}<label>Nome<input [value]="newName()" (input)="newName.set($any($event.target).value)" /></label><label>Produto<input [value]="newProduct()" (input)="newProduct.set($any($event.target).value)" /></label><label>Início previsto<input type="date" [value]="newStart()" (input)="newStart.set($any($event.target).value)" /></label><label>Fim previsto<input type="date" [value]="newEnd()" (input)="newEnd.set($any($event.target).value)" /></label><button type="button" (click)="createCampaign()" [disabled]="campaignBusy()">{{campaignBusy()?'Salvando…':'Criar e selecionar'}}</button>@if(campaignError()){<p class="checkout-error" role="alert">{{campaignError()}}</p>}</div>}
            }
            <p>A campanha e o período serão revalidados na cotação antes do envio do pedido.</p></section>
          <p class="checkout-period">◷ &nbsp; @if(selectedPeriod()){Período fixo: {{selectedPeriod()!.nome}}. As datas não podem ser alteradas no carrinho.}@else{Selecione um período para consultar preço e disponibilidade.}</p>
          <div class="checkout-drawer__scroll">
            @for(group of groups();track group.city){
              <section class="city-group"><header><h2>⌖ &nbsp; {{group.city | uppercase}}</h2><p>{{group.items.length}} {{group.items.length===1?'peça':'peças'}} <strong>{{group.subtotal | currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong></p></header>
              @for(item of group.items;track item.id){<article class="checkout-row"><div class="checkout-row__media">@if(item.imageUrl && !fotos.tem(item.id)){<img [src]="item.imageUrl" [alt]="item.name" (error)="fotos.marcar(item.id)" />}@else{<span>{{item.mediaType.slice(0,2).toUpperCase()}}</span>}</div><div class="checkout-row__main"><span class="media-chip">{{item.mediaType}}</span><small>{{item.code}}</small><a [routerLink]="['/pecas',item.code]">{{item.name}}</a><p>{{item.address}}</p></div><div class="checkout-row__actions"><strong>{{item.price | currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong><button type="button" (click)="remove(item.id)">Remover</button></div></article>}
              </section>
            }
          </div>
          <footer class="checkout-drawer__footer"><p class="checkout-warning">* Você não está realizando uma solicitação de reserva. Ao clicar em “Fechar Pedido” você realiza uma solicitação de compra.</p><label class="checkout-terms"><input type="checkbox" [checked]="accepted()" (change)="accepted.set($any($event.target).checked)" /><span>Li e aceito os Termos de uso, a política de cancelamento e as condições comerciais da exibidora.</span></label><div class="checkout-total"><span>Total geral</span><strong>{{(quote()?.total ?? cart.subtotal()) | currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong></div>
            @if(error()){<p class="checkout-error" role="alert">{{error()}}</p>}
            @if(quote()){<p class="checkout-quote-ok" role="status">Cotação confirmada. Confira o total e aceite as condições antes de enviar.</p>}
            <div class="checkout-actions"><button type="button" (click)="saveSimulation()" [disabled]="!canSaveSimulation()" [title]="canSaveSimulation()?'Salva o carrinho na campanha sem solicitar compra':'Selecione a campanha e o período para salvar a simulação'">{{savingSimulation()?'Salvando…':'Salvar simulação'}}</button>@if(!quote()){<button type="button" (click)="getQuote()" [disabled]="loading()">{{loading()?'Consultando…':!auth.user()&&!prototype?'Entrar para consultar':'Conferir cotação'}}</button>}@else{<button type="button" (click)="placeOrder()" [disabled]="loading()||!accepted()||!canSubmit()">{{loading()?'Enviando…':'Fechar pedido'}}</button>}</div>
            @if(quote()&&!canSubmit()&&!prototype){<p class="checkout-blocked">Seu cadastro precisa estar aprovado para enviar o pedido.</p>}
          </footer>
        }
      </main>
    </div>
  `,
})
export class AurumCheckoutPage {
  readonly fotos=new FotosIndisponiveis();
  readonly cart=inject(CartService);
  private readonly checkout=inject(CheckoutService);
  private readonly campaignSelection=inject(CampaignSelectionService);
  readonly auth=inject(AdvertiserAuthService);
  private readonly router=inject(Router);
  readonly prototype=environment.usePrototypeFixtures;
  readonly quote=signal<CheckoutQuote|null>(null);
  readonly context=signal<CheckoutContext|null>(null);
  readonly campaignId=signal<number|null>(null);
  readonly periodCode=signal('');
  readonly periods=computed(()=>this.context()?.campaigns.find(c=>c.id===this.campaignId())?.periods??[]);
  readonly selectedPeriod=computed(()=>this.periods().find(p=>p.codigo===this.periodCode()));
  readonly loading=signal(false);
  readonly savingSimulation=signal(false);
  /** VEI-SUP-62: simulação não é compra, então não depende do aceite dos termos. */
  readonly canSaveSimulation=computed(()=>!!this.campaignId()&&!!this.selectedPeriod()&&this.cart.count()>0&&!this.loading()&&!this.savingSimulation()&&this.canSubmit());
  readonly accepted=signal(false);
  readonly error=signal('');
  readonly contextFailed=signal(false);
  readonly creatingCampaign=signal(false);
  readonly campaignBusy=signal(false);
  readonly campaignError=signal('');
  readonly newName=signal('');
  readonly newProduct=signal('');
  readonly newStart=signal('');
  readonly newEnd=signal('');
  readonly newClientId=signal<number|null>(null);
  readonly groups=computed(()=>{
    const byCity=new Map<string,InventoryPoint[]>();
    for(const item of this.cart.items()){const city=`${item.city || 'Cidade não informada'} — ${item.state || ''}`;byCity.set(city,[...(byCity.get(city)??[]),item]);}
    return [...byCity].map(([city,items])=>({city,items,subtotal:items.reduce((total,item)=>total+item.price,0)}));
  });
  private idempotencyKey=crypto.randomUUID();
  constructor(){
    // O kycStatus da sessão vem do login e fica velho quando a exibidora aprova depois (VEI-SUP-48): sempre reconsulta /me.
    if(this.prototype)this.loadContext();
    else if(this.auth.isAuthenticated())this.auth.loadMe().subscribe({next:()=>this.loadContext(),error:()=>{if(this.auth.user())this.loadContext();else this.auth.logout();}});
  }
  loadContext(){
    if(!this.prototype&&this.auth.user()?.kycStatus!=='approved')return;
    this.contextFailed.set(false);
    this.checkout.context().subscribe({next:context=>{
      this.context.set(context);
      const selected=context.campaigns.find(c=>c.id===this.campaignSelection.campaignId());
      if(selected)this.selectCampaign(String(selected.id));
      else if(context.campaigns.length===1)this.selectCampaign(String(context.campaigns[0].id));
    },error:()=>this.contextFailed.set(true)});
  }
  canSubmit(){return this.prototype||this.auth.user()?.kycStatus==='approved';}
  createCampaign(){
    if(this.campaignBusy())return;
    const name=this.newName().trim(),product=this.newProduct().trim(),startDate=this.newStart(),endDate=this.newEnd();
    if(name.length<3||product.length<2||!startDate||!endDate||endDate<startDate){this.campaignError.set('Informe nome, produto e datas válidas.');return;}
    const clients=this.context()?.clients;
    if(clients&&!this.newClientId()){this.campaignError.set('Selecione o anunciante representado.');return;}
    this.campaignBusy.set(true);this.campaignError.set('');
    this.checkout.createCampaign({name,product,startDate,endDate,budget:null,...(clients&&this.newClientId()?{clientId:this.newClientId()!}:{})}).pipe(finalize(()=>this.campaignBusy.set(false))).subscribe({
      next:campaign=>{this.campaignSelection.selectCampaign(campaign.id);this.creatingCampaign.set(false);this.newName.set('');this.newProduct.set('');this.loadContext();},
      error:(e:{error?:{message?:string;details?:string[]}})=>this.campaignError.set(e?.error?.details?.length?e.error.details.join(' '):e?.error?.message||'Não foi possível criar a campanha. Confira o cadastro comercial e tente novamente.'),
    });
  }
  remove(id:number){this.cart.remove(id);this.quote.set(null);this.accepted.set(false);}
  selectCampaign(raw:string){
    const id=Number(raw);this.campaignId.set(Number.isInteger(id)&&id>0?id:null);
    this.campaignSelection.selectCampaign(this.campaignId());
    const periods=this.periods();const preferred=this.campaignSelection.periodCode();
    const code=periods.some(period=>period.codigo===preferred)?preferred:periods.length===1?periods[0].codigo:'';
    this.periodCode.set(code);this.campaignSelection.periodCode.set(code);
    this.quote.set(null);this.accepted.set(false);
  }
  selectPeriod(code:string){this.periodCode.set(code);this.campaignSelection.periodCode.set(code);this.quote.set(null);this.accepted.set(false);}
  getQuote(){
    if(this.loading()||!this.cart.count())return;
    if(!this.prototype&&!this.auth.user()){void this.router.navigate(['/login'],{queryParams:{returnUrl:'/checkout'}});return;}
    if(!this.prototype&&this.auth.user()?.kycStatus!=='approved'){
      this.auth.loadMe().subscribe({next:user=>{if(user.kycStatus==='approved'){this.loadContext();this.error.set('Seu cadastro já está aprovado. Selecione ou crie uma campanha para cotar.');}else void this.router.navigate(['/kyc-status']);},error:()=>this.error.set('Não foi possível confirmar seu cadastro. Tente novamente.')});
      return;
    }
    const campaignId=this.campaignId();const periodCode=this.periodCode();
    if(!campaignId||!periodCode){this.error.set('Selecione uma campanha e um período para cotar.');return;}
    const ids=this.cart.items().map(item=>item.id).join(',');
    this.quote.set(null);this.accepted.set(false);this.loading.set(true);this.error.set('');
    this.checkout.quote(this.cart.items(),campaignId,periodCode).pipe(finalize(()=>this.loading.set(false))).subscribe({next:quote=>{if(ids===this.cart.items().map(item=>item.id).join(',')&&campaignId===this.campaignId()&&periodCode===this.periodCode()){this.idempotencyKey=crypto.randomUUID();this.quote.set(quote);}},error:(e:{error?:{message?:string}})=>this.error.set(e?.error?.message||'Não foi possível confirmar preço e disponibilidade. Tente novamente.')});
  }
  saveSimulation(){
    const campaignId=this.campaignId();const periodCode=this.periodCode();
    if(!this.canSaveSimulation()||!campaignId||!periodCode)return;
    this.savingSimulation.set(true);this.error.set('');
    this.checkout.saveSimulation(this.cart.items(),campaignId,periodCode).pipe(finalize(()=>this.savingSimulation.set(false))).subscribe({next:(order:OrderConfirmation)=>{this.cart.clear();void this.router.navigate(['/pedidos/sucesso'],{state:{order}});},error:(e:{error?:{message?:string}})=>this.error.set(e?.error?.message||'Não foi possível salvar a simulação. Tente novamente.')});
  }
  placeOrder(){
    const quote=this.quote();if(!quote||!this.accepted()||!this.canSubmit()||this.loading()||!this.cart.count())return;
    if(Date.parse(quote.expiresAt)<=Date.now()){this.quote.set(null);this.error.set('A cotação expirou. Confira o preço novamente.');return;}
    this.loading.set(true);this.error.set('');
    this.checkout.placeOrder(quote,this.idempotencyKey).pipe(finalize(()=>this.loading.set(false))).subscribe({next:(order:OrderConfirmation)=>{this.cart.clear();void this.router.navigate(['/pedidos/sucesso'],{state:{order}});},error:()=>this.error.set('Não foi possível enviar o pedido. Tente novamente sem fechar a página.')});
  }
}
