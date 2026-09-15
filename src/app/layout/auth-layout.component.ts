import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { BrandingService } from '../core/branding/branding.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterLink, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="auth-shell">
      <section class="auth-shell__story" aria-label="Sobre a plataforma">
        <a routerLink="/mapa" class="brand">
          @if (brand(); as currentBrand) {
            <img [src]="currentBrand.logoUrl" [alt]="currentBrand.nomeExibicao" />
          }
        </a>
        <div class="story-copy">
          <p class="kicker">Mídia exterior, vista por inteiro.</p>
          <h1>Encontre presença para sua marca no mapa da cidade.</h1>
          <p>Compare inventário, alcance e investimento antes de fechar seu pedido.</p>
        </div>
        <p class="mobile-tagline">Sua marca no espaço que importa.</p>
        <div class="street-lines" aria-hidden="true"><i></i><i></i><i></i></div>
      </section>
      <section class="auth-shell__form">
        @if (prototype) { <p class="prototype-notice" role="note">Prévia de desenvolvimento: cadastro e acesso são simulados. Nenhuma conta real será criada.</p> }
        <router-outlet />
      </section>
    </main>
  `,
  styles: [`
    :host{display:block;min-height:100dvh}.auth-shell{display:grid;grid-template-columns:minmax(340px,600px) minmax(0,1fr);min-height:100dvh;background:var(--paper-bg)}
    .auth-shell__story{position:relative;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;padding:clamp(28px,5vw,64px);color:var(--white);background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 88%,#1a1a1b),var(--primary-color))}
    .brand{position:relative;z-index:1;width:max-content}.brand img{display:block;width:min(150px,45vw);height:48px;object-fit:contain;object-position:left}.mobile-tagline{display:none}
    .story-copy{position:relative;z-index:1;max-width:560px;padding:80px 0}.kicker{margin:0 0 18px;color:var(--secondary-color);font-weight:700}.story-copy h1{max-width:14ch;margin:0;color:var(--white);font-size:clamp(2.7rem,5vw,5.4rem);font-weight:600;line-height:.98}.story-copy>p:last-child{max-width:44ch;margin:28px 0 0;color:color-mix(in srgb,var(--white) 76%,transparent);font-size:1.05rem}
    .street-lines{position:absolute;inset:auto -10% -10% 5%;height:44%;transform:rotate(-9deg);opacity:.22}.street-lines i{display:block;height:30%;margin:18px;border:1px solid var(--secondary-color);border-radius:50%}
    .auth-shell__form{display:grid;place-items:center;padding:clamp(24px,6vw,80px)}.prototype-notice{justify-self:stretch;max-width:560px;margin:0 0 16px;padding:12px 16px;border-radius:8px;background:var(--warning-bg);color:var(--charcoal);font-size:.84rem}
    @media(max-width:820px){.auth-shell{grid-template-columns:1fr;align-content:start}.auth-shell__story{height:208px;min-height:0;align-items:center;justify-content:flex-start;gap:13px;padding:35px 24px 20px;border-radius:0 0 30px 30px}.brand{background:transparent}.brand img{width:160px;height:80px;filter:brightness(0) invert(1)}.story-copy,.street-lines{display:none}.mobile-tagline{display:block;max-width:310px;margin:0;color:color-mix(in srgb,var(--white) 85%,transparent);font-size:13px;text-align:center}.auth-shell__form{display:block;padding:34px 24px 48px}.prototype-notice{margin-bottom:24px}}
  `]
})
export class AuthLayoutComponent {
  readonly brand = inject(BrandingService).branding;
  readonly prototype = environment.usePrototypeFixtures;
}
