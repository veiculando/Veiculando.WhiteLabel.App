import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnunciantesService, Representacao } from '../../core/anunciantes/anunciantes.service';
import { statusCarteira } from '../../core/carteira/carteira.service';
import { AppClients, filtrarClientes, mensagensDoServidor } from './campaign.models';
import { CampaignsService } from './campaigns.service';

/**
 * VEI-RD-67b: gateway "Selecione o Anunciante". "Adicionar anunciante" só com
 * podeAdicionarAnunciante; nesse caso também mostra os pedidos de representação que ainda não
 * foram aprovados (VEI-RD-67j), com o link para acompanhar ou corrigir.
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
        @if (data()?.podeAdicionarAnunciante) { <a class="add-link" routerLink="/anunciante/clientes/novo">Adicionar anunciante</a> }
        <div class="toggle" role="group" aria-label="Visualização">
          <button type="button" [class.is-active]="view() === 'cards'" (click)="view.set('cards')">Cards</button>
          <button type="button" [class.is-active]="view() === 'lista'" (click)="view.set('lista')">Lista</button>
        </div>
      </div>
      <label class="search">Buscar por nome, razão social ou CNPJ
        <input type="search" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      @if (pedidos().length) {
        <div class="pending" role="status">
          <strong>Pedidos de representação</strong>
          <ul>
            @for (p of pedidos(); track p.id) {
              <li>{{ p.nome || p.razaoSocial || p.cnpj }} — {{ rotulo(p) }}@if (p.status === 'AjustesSolicitados') { (corrigir pendências)}</li>
            }
          </ul>
          <a routerLink="/anunciante/clientes/novo">Acompanhar pedidos</a>
        </div>
      }
      @if (loading()) { <p>Carregando anunciantes…</p> }
      @else if (error()) { <p class="campaigns__error">{{ error() }}</p> }
      @else if (!data()?.clientes?.length) {
        <p class="empty">Nenhum anunciante na sua carteira.</p>
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

  /** Pedidos de representação ainda não aprovados (VEI-RD-67j). */
  readonly pedidos = signal<Representacao[]>([]);
  private readonly anunciantes = inject(AnunciantesService);

  rotulo(p: Representacao) { return statusCarteira[p.status] ?? p.status; }

  constructor() {
    inject(CampaignsService).clients().subscribe({
      next: data => {
        this.data.set(data);
        this.loading.set(false);
        if (data.podeAdicionarAnunciante) this.anunciantes.listar().subscribe({
          next: itens => this.pedidos.set(itens.filter(i => i.status !== 'Aprovado')),
          error: () => undefined,
        });
      },
      error: err => { this.error.set(mensagensDoServidor(err, 'Não foi possível carregar seus anunciantes.')[0]); this.loading.set(false); },
    });
  }
}
