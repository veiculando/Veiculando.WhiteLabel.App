import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdvertiserAuthService } from '../core/auth/advertiser-auth.service';
import { BrandingService } from '../core/branding/branding.service';
import { CartService } from '../core/cart/cart.service';
import { CartDrawerService } from '../core/cart/cart-drawer.service';

@Component({
  selector: 'app-shell',
  imports: [CurrencyPipe, RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <a routerLink="/mapa" class="topbar__brand" aria-label="Voltar ao mapa" (click)="closePanels()">
        @if (brand(); as currentBrand) { <img [src]="currentBrand.logoUrl" [alt]="currentBrand.nomeExibicao" /> }
      </a>
      <nav id="mobile-navigation" [class.is-open]="menuOpen()" aria-label="Navegação principal">
        <a routerLink="/mapa" routerLinkActive="is-active" (click)="closePanels()">Início</a>
        <a href="mailto:suporte@veiculando.com.br">Suporte</a>
      </nav>
      <div class="topbar__actions">
        <!-- Minhas Campanhas pertence à sprint 11.5; não publicar CTA sem rota. -->
        <button class="cart-button" type="button" [attr.aria-label]="'Abrir carrinho com ' + cart.count() + ' itens'" [attr.aria-expanded]="cartOpen()" (click)="toggleCart()"><span class="cart-icon" aria-hidden="true">▱</span><span class="cart-label">Carrinho</span><b>{{ cart.count() }}</b></button>
        @if (auth.user()) { <button type="button" class="profile-button" aria-label="Abrir meu perfil" [attr.aria-expanded]="profileOpen()" (click)="toggleProfile()">●</button> }
        @else { <a class="profile-button profile-button--guest" routerLink="/login">Entrar</a> }
        <button type="button" class="menu-button" aria-label="Abrir navegação" aria-controls="mobile-navigation" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())"><span></span><span></span><span></span></button>
      </div>
    </header>
    <main class="app-content"><router-outlet /></main>
    @if (cartOpen() || profileOpen()) {
      <button class="drawer-scrim" type="button" aria-label="Fechar painel" (click)="closePanels()"></button>
    }
    @if (cartOpen()) {
      <aside class="aurum-drawer cart-drawer" aria-label="Carrinho" role="dialog" aria-modal="true">
        <header class="drawer-head"><h2><span aria-hidden="true">▱</span> Carrinho <b>{{cart.count()}}</b></h2><button type="button" aria-label="Fechar carrinho" (click)="cartOpen.set(false)">×</button></header>
        <div class="drawer-scroll">
          @if (!cart.count()) { <div class="drawer-empty"><h3>Seu carrinho está vazio</h3><p>Encontre as peças ideais para sua campanha no mapa.</p><button type="button" (click)="closePanels()">Explorar mapa</button></div> }
          @for (item of cart.items(); track item.id) {
            <article class="cart-drawer-item">
              <div class="cart-drawer-item__top"><span class="media-chip">{{item.mediaType}}</span><button type="button" [attr.aria-label]="'Remover ' + item.name" (click)="cart.remove(item.id)">×</button></div>
              <a [routerLink]="['/pecas', item.code]" (click)="closePanels()">{{item.name}} — {{item.code}}</a>
              <p>⌖ {{item.address}}</p>
              <div class="cart-drawer-item__bottom"><span>Período a confirmar</span><strong>{{item.price | currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong></div>
            </article>
          }
        </div>
        <footer class="drawer-footer"><div><span>Subtotal</span><strong>{{cart.subtotal() | currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong></div><a routerLink="/checkout" (click)="closePanels()">Ir para o checkout <span aria-hidden="true">→</span></a></footer>
      </aside>
    }
    @if (profileOpen()) {
      <aside class="aurum-drawer profile-drawer" aria-label="Meu perfil" role="dialog" aria-modal="true">
        <header class="profile-head"><h2>Meu perfil</h2><button type="button" aria-label="Fechar perfil" (click)="profileOpen.set(false)">×</button></header>
        @if (auth.user(); as user) {
          <div class="profile-identity"><div aria-hidden="true">{{user.name.charAt(0).toUpperCase()}}</div><p><strong>{{user.name}}</strong><span>{{user.email}}</span></p></div>
          <h3>Dados de cadastro</h3><dl><dt>Nome completo</dt><dd>{{user.name}}</dd><dt>E-mail</dt><dd>{{user.email}}</dd><dt>Status do cadastro</dt><dd>{{user.kycStatus === 'approved' ? 'Aprovado' : 'Em acompanhamento'}}</dd></dl>
          <p class="profile-note">Alterações de cadastro e histórico de pedidos dependem dos serviços de perfil.</p>
          <button class="profile-logout" type="button" (click)="closePanels(); auth.logout()">Sair da conta</button>
        }
      </aside>
    }
  `,
})
export class AppShellComponent {
  readonly brand = inject(BrandingService).branding;
  readonly cart = inject(CartService);
  readonly auth = inject(AdvertiserAuthService);
  readonly menuOpen = signal(false);
  readonly cartOpen = inject(CartDrawerService).open;
  readonly profileOpen = signal(false);

  @HostListener('document:keydown.escape') onEscape() { this.closePanels(); }
  closePanels() { this.cartOpen.set(false); this.profileOpen.set(false); this.menuOpen.set(false); }
  toggleCart() { this.profileOpen.set(false); this.cartOpen.update(value => !value); }
  toggleProfile() { this.cartOpen.set(false); this.profileOpen.update(value => !value); }
}
