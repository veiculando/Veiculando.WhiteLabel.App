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
          <p class="kicker">Plataforma de mídia OOH</p>
          <h1>Sua marca no <em>espaço que</em> importa.</h1>
          <p>Busque, reserve e acompanhe suas peças de mídia exterior direto no inventário da exibidora.</p>
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
    .auth-shell__story{position:relative;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;padding:clamp(28px,4vw,60px);border-top:4px solid var(--secondary-color);color:var(--white);background:var(--primary-color) url('/assets/figma/auth-raw-1.png') center/cover}
    .brand{position:relative;z-index:1;width:max-content}.brand img{display:block;width:min(150px,45vw);height:48px;object-fit:contain;object-position:left}.mobile-tagline{display:none}
    .story-copy{position:relative;z-index:1;max-width:470px;padding:80px 0}.kicker{margin:0 0 18px;color:var(--secondary-color);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.story-copy h1{max-width:14ch;margin:0;color:var(--white);font-size:clamp(2.7rem,4vw,4.2rem);font-weight:600;line-height:1.08}.story-copy h1 em{color:var(--secondary-color);font-style:normal}.story-copy>p:last-child{max-width:43ch;margin:28px 0 0;color:color-mix(in srgb,var(--white) 85%,transparent);font-size:1rem}
    .street-lines{position:absolute;top:28%;right:-26%;width:65%;aspect-ratio:1;border-radius:50%;background:#b616201f}.street-lines i{display:none}
    .auth-shell__form{display:grid;place-items:center;padding:clamp(24px,6vw,80px)}.prototype-notice{justify-self:stretch;max-width:560px;margin:0 0 16px;padding:12px 16px;border-radius:8px;background:var(--warning-bg);color:var(--charcoal);font-size:.84rem}
    @media(max-width:820px){.auth-shell{grid-template-columns:1fr;align-content:start}.auth-shell__story{height:208px;min-height:0;align-items:center;justify-content:flex-start;gap:13px;padding:28px 24px 20px}.brand{background:transparent}.brand img{width:130px;height:80px}.story-copy,.street-lines{display:none}.mobile-tagline{display:block;max-width:310px;margin:0;color:color-mix(in srgb,var(--white) 85%,transparent);font-size:13px;text-align:center}.auth-shell__form{display:block;padding:34px 24px 48px}.prototype-notice{margin-bottom:24px}}
  `]
})
export class AuthLayoutComponent {
  readonly brand = inject(BrandingService).branding;
  readonly prototype = environment.usePrototypeFixtures;
}
