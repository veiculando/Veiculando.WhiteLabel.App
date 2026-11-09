import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppClients, filtrarClientes, mensagensDoServidor } from './campaign.models';
import { CampaignsService } from './campaigns.service';

/**
 * VEI-RD-67b: gateway "Selecione o Anunciante". Nesta fase não há filtros de KYC/vínculo nem
 * ações de onboarding (voltam com o VEI-RD-71m); "Adicionar" só com podeAdicionarAnunciante.
 */
@Component({
  selector: 'app-clients-gateway',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './campaigns.scss',
  template: `
    <section class="campaigns">
      <div class="campaigns__bar">
        <h1>Selecione o Anunciante</h1>
        <div class="toggle" role="group" aria-label="Visualização">
          <button type="button" [class.is-active]="view() === 'cards'" (click)="view.set('cards')">Cards</button>
          <button type="button" [class.is-active]="view() === 'lista'" (click)="view.set('lista')">Lista</button>
        </div>
      </div>
      <label class="search">Buscar por nome, razão social ou CNPJ
        <input type="search" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      @if (loading()) { <p>Carregando anunciantes…</p> }
      @else if (error()) { <p class="campaigns__error">{{ error() }}</p> }
      @else if (!data()?.clientes?.length) {
        <p class="empty">Nenhum anunciante na sua carteira.</p>
        @if (data()?.podeAdicionarAnunciante) { <a routerLink="/anunciante/clientes/novo">Adicionar anunciante</a> }
      } @else if (!rows().length) { <p class="empty">Nenhum anunciante encontrado para "{{ query() }}".</p> }
      @else {
        <ul [class]="view() === 'cards' ? 'client-cards' : 'client-list'">
          @for (client of rows(); track client.id) {
            <li>
              <strong>{{ client.nome }}</strong>
              <span>{{ client.cnpj }}</span>
              <a routerLink="/anunciante/campanhas" [queryParams]="{ clienteId: client.id }">Ver campanhas</a>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class ClientsGatewayPage {
  readonly data = signal<AppClients | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly view = signal<'cards' | 'lista'>('cards');
  readonly rows = computed(() => filtrarClientes(this.data()?.clientes ?? [], this.query()));

  constructor() {
    inject(CampaignsService).clients().subscribe({
      next: data => { this.data.set(data); this.loading.set(false); },
      error: err => { this.error.set(mensagensDoServidor(err, 'Não foi possível carregar seus anunciantes.')[0]); this.loading.set(false); },
    });
  }
}
