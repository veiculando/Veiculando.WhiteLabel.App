import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdvertiserAuthService } from '../../core/auth/advertiser-auth.service';
import { CAMPAIGN_STATUS_LABEL, CampaignSummary } from './campaign.models';
import { CampaignsService } from './campaigns.service';

@Component({
  selector: 'app-campaigns',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './campaigns.scss',
  template: `
    <section class="campaigns">
      @if (agency() && active(); as client) {
        <header class="advertiser">
          @if (client.logoUrl) { <img [src]="client.logoUrl" [alt]="client.nome" /> }
          <div>
            <strong>{{ client.nome }}</strong>
            <span>{{ client.cnpj }}</span>
          </div>
          <button type="button" disabled>Trocar anunciante</button>
        </header>
      }
      <div class="campaigns__bar">
        <h1>Minhas campanhas</h1>
        <button type="button" disabled>Criar nova campanha</button>
      </div>
      <label>Filtrar <input [value]="query()" (input)="query.set($any($event.target).value)" /></label>
      @if (error()) { <p class="campaigns__error">{{ error() }}</p> }
      @else if (!rows().length) { <p>Nenhuma campanha para este anunciante.</p> }
      @else {
        <ul>
          @for (item of rows(); track item.codigo) {
            <li>
              <a [routerLink]="['/anunciante/campanhas/campanha', item.codigo]">{{ item.nome }}</a>
              <span class="badge">{{ label(item.status) }}</span>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class CampaignsPage {
  private readonly api = inject(CampaignsService);
  private readonly auth = inject(AdvertiserAuthService);
  private readonly all = signal<CampaignSummary[]>([]);
  readonly query = signal('');
  readonly error = signal('');
  readonly agency = () => this.auth.user()?.accountType === 'ag';
  readonly active = () => this.all()[0]?.anunciante;
  readonly rows = () => {
    const term = this.query().trim().toLowerCase();
    return this.all().filter(item => !term || item.nome.toLowerCase().includes(term) || item.codigo.toLowerCase().includes(term));
  };
  readonly label = (status: CampaignSummary['status']) => CAMPAIGN_STATUS_LABEL[status] ?? status;

  constructor() {
    this.api.list().subscribe({
      next: items => this.all.set(items),
      error: () => this.error.set('A lista de campanhas ainda não está disponível neste ambiente.'),
    });
  }
}
