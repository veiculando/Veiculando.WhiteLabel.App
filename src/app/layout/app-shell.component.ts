import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdvertiserAuthService } from '../core/auth/advertiser-auth.service';
import { BrandingService } from '../core/branding/branding.service';
import { CartService } from '../core/cart/cart.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <a routerLink="/mapa" class="topbar__brand">
        @if (brand(); as currentBrand) { <img [src]="currentBrand.logoUrl" [alt]="currentBrand.nomeExibicao" /> }
      </a>
      <nav id="mobile-navigation" [class.is-open]="menuOpen()" aria-label="Navegação principal">
        <a routerLink="/mapa" routerLinkActive="is-active" (click)="menuOpen.set(false)">Explorar mapa</a>
        <a routerLink="/kyc-status" routerLinkActive="is-active" (click)="menuOpen.set(false)">Cadastro e KYC</a>
        <a href="mailto:suporte@veiculando.com.br">Suporte</a>
        <button class="mobile-logout" type="button" (click)="auth.logout()">Sair</button>
      </nav>
      <div class="topbar__actions">
        @if (auth.user(); as user) { <span class="user-name">{{ user.name }}</span> }
        <a class="cart-button" routerLink="/checkout" [attr.aria-label]="'Carrinho com ' + cart.count() + ' itens'">
          <span aria-hidden="true">▱</span> Carrinho <b>{{ cart.count() }}</b>
        </a>
        <button type="button" class="profile-button" (click)="auth.logout()">Sair</button>
        <button type="button" class="menu-button" aria-label="Abrir navegação" aria-controls="mobile-navigation" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())"><span></span><span></span><span></span></button>
      </div>
    </header>
    <main class="app-content"><router-outlet /></main>
  `,
  styles: [`
    :host{display:block;min-height:100dvh}.topbar{position:sticky;z-index:50;top:0;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:34px;min-height:76px;padding:10px clamp(18px,4vw,54px);border-bottom:1px solid var(--divider);background:color-mix(in srgb,var(--white) 94%,transparent);backdrop-filter:blur(18px)}
    .topbar__brand img{display:block;width:166px;height:44px;object-fit:contain;object-position:left}.topbar nav{display:flex;gap:8px}.topbar nav a,.profile-button{padding:10px 13px;border-radius:10px;color:var(--on-surface);font-size:.9rem;font-weight:650;text-decoration:none}.topbar nav a:hover,.topbar nav a.is-active{color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 7%,transparent)}
    .topbar__actions{display:flex;align-items:center;gap:10px}.user-name{max-width:150px;overflow:hidden;color:var(--on-surface);font-size:.82rem;text-overflow:ellipsis;white-space:nowrap}.cart-button{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:999px;background:var(--primary-color);color:var(--white);font-size:.84rem;font-weight:700;text-decoration:none}.cart-button b{display:grid;min-width:22px;height:22px;place-items:center;border-radius:50%;background:var(--secondary-color);color:var(--charcoal)}.profile-button{border:0;background:transparent;cursor:pointer}.menu-button,.mobile-logout{display:none}.app-content{min-height:calc(100dvh - 76px)}
    @media(max-width:860px){.topbar{grid-template-columns:1fr auto;gap:8px;min-height:64px;padding:8px 16px;background:var(--header-footer-bg)}.topbar nav{display:none;position:absolute;top:64px;right:0;left:0;flex-direction:column;padding:12px 16px;background:var(--header-footer-bg);box-shadow:0 12px 20px #1a1a1b30}.topbar nav.is-open{display:flex}.topbar nav a,.topbar nav button{color:var(--white)}.mobile-logout{display:block;padding:10px 13px;border:0;background:transparent;font:inherit;text-align:left}.user-name,.profile-button{display:none}.topbar__brand img{width:112px;height:42px;filter:brightness(0) invert(1)}.cart-button{padding:5px;background:transparent;font-size:0}.cart-button span{font-size:1.4rem}.cart-button b{position:relative;top:-11px;left:-10px;min-width:16px;height:16px;font-size:.6rem}.menu-button{display:grid;gap:5px;padding:7px;border:0;background:transparent;cursor:pointer}.menu-button span{display:block;width:25px;height:2px;border-radius:2px;background:var(--white)}.app-content{min-height:calc(100dvh - 64px)}}
  `]
})
export class AppShellComponent {
  readonly brand = inject(BrandingService).branding;
  readonly cart = inject(CartService);
  readonly auth = inject(AdvertiserAuthService);
  readonly menuOpen = signal(false);
}
