import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppClients, CAMPAIGN_STATUSES, CAMPAIGN_STATUS_LABEL, CampaignStatus, CampaignSummary, mensagensDoServidor } from './campaign.models';
import { CampaignFormComponent } from './campaign-form.component';
import { CampaignsService } from './campaigns.service';

/** Busca local só por nome/código da campanha; o cliente já veio filtrado pelo servidor. */
export function filtrarCampanhas(items: CampaignSummary[], termo: string, status: CampaignStatus | null) {
  const texto = termo.trim().toLowerCase();
  return items.filter(item => (!status || item.status === status) &&
    (!texto || item.nome.toLowerCase().includes(texto) || item.codigo.toLowerCase().includes(texto)));
}

/** VEI-RD-45a: painel de Minhas Campanhas; header contextual com Trocar/Gerenciar (VEI-RD-67c). */
@Component({
  selector: 'app-campaigns',
  imports: [RouterLink, CurrencyPipe, DatePipe, CampaignFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './campaigns.scss',
  template: `
    <section class="campaigns">
      @if (multiCliente() && cliente(); as client) {
        <header class="advertiser">
          <div><strong>{{ client.nome }}</strong><span>{{ client.cnpj }}</span></div>
          <div class="advertiser__menu">
            <button type="button" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())">Trocar anunciante ▾</button>
            @if (menuOpen()) {
              <ul role="menu">
                @for (other of outros(); track other.id) {
                  <li><a role="menuitem" routerLink="/anunciante/campanhas" [queryParams]="{ clienteId: other.id }" (click)="menuOpen.set(false)">{{ other.nome }}</a></li>
                }
                <li><a role="menuitem" routerLink="/anunciante/clientes">Gerenciar anunciantes</a></li>
                @if (clients()?.podeAdicionarAnunciante) { <li><a role="menuitem" routerLink="/anunciante/clientes/novo">Adicionar anunciante</a></li> }
              </ul>
            }
          </div>
        </header>
      }
      <div class="campaigns__bar">
        <h1>Minhas campanhas</h1>
        <button type="button" class="primary" [disabled]="!podeCriar()" (click)="formOpen.set(true)">Criar Nova Campanha</button>
      </div>
      <div class="filters">
        <label class="search">Buscar campanha <input type="search" [value]="query()" (input)="query.set($any($event.target).value)" /></label>
        <div class="chips" role="group" aria-label="Filtrar por status">
          <button type="button" [class.is-active]="!status()" (click)="status.set(null)">Todas</button>
          @for (s of statuses; track s) {
            <button type="button" [class.is-active]="status() === s" (click)="status.set(s)">{{ label(s) }}</button>
          }
        </div>
      </div>
      @if (loading()) { <p>Carregando campanhas…</p> }
      @else if (error()) { <p class="campaigns__error">{{ error() }}</p> }
      @else if (!all().length) {
        <p class="empty">{{ clients() && !clients()!.clientes.length ? 'Nenhum anunciante na sua carteira ainda.' : 'Nenhuma campanha para este anunciante.' }}</p>
      } @else if (!rows().length) { <p class="empty">Nenhuma campanha com esses filtros.</p> }
      @else {
        <table class="campaign-table">
          <thead><tr><th>Campanha</th><th>Status</th><th>Período</th><th>Budget</th><th>Confirmados</th><th>Pendentes</th></tr></thead>
          <tbody>
            @for (item of rows(); track item.codigo) {
              <tr>
                <td><a [routerLink]="['/anunciante/campanhas/campanha', item.codigo]">{{ item.nome }}</a><small>{{ item.codigo }}</small></td>
                <td><span class="badge" [class]="'badge badge--' + item.status">{{ label(item.status) }}</span></td>
                <td>{{ item.dataInicio | date:'dd/MM/yyyy' }} – {{ item.dataFim | date:'dd/MM/yyyy' }}</td>
                <td>{{ item.budgetTotal | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
                <td>{{ item.pedidosConfirmados | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
                <td>{{ item.pedidosPendentes | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
      @if (formOpen() && clients(); as data) {
        <app-campaign-form [clients]="formClients()" [perfil]="data.perfil" [clienteAtual]="clienteId()"
          (closed)="formOpen.set(false)" (saved)="criada($event)" />
      }
    </section>
  `,
})
export class CampaignsPage {
  private readonly api = inject(CampaignsService);
  private readonly router = inject(Router);
  readonly clienteId = signal<number | null>(null);
  readonly clients = signal<AppClients | null>(null);
  readonly all = signal<CampaignSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly status = signal<CampaignStatus | null>(null);
  readonly menuOpen = signal(false);
  readonly formOpen = signal(false);
  readonly statuses = CAMPAIGN_STATUSES;
  readonly label = (status: CampaignStatus) => CAMPAIGN_STATUS_LABEL[status] ?? status;
  readonly rows = computed(() => filtrarCampanhas(this.all(), this.query(), this.status()));
  readonly multiCliente = computed(() => !!this.clients() && this.clients()!.perfil !== 'anunciante_direto');
  readonly cliente = computed(() => this.clients()?.clientes.find(c => c.id === this.clienteId()) ?? null);
  readonly outros = computed(() => this.clients()?.clientes.filter(c => c.id !== this.clienteId()) ?? []);
  readonly podeCriar = computed(() => !!this.clients()?.clientes.length);
  /** No painel de um cliente, o modal já nasce com ele (travado quando é o único). */
  readonly formClients = computed(() => this.cliente() ? [this.cliente()!] : this.clients()?.clientes ?? []);

  constructor() {
    this.api.clients().subscribe({ next: data => this.clients.set(data), error: () => this.clients.set(null) });
    inject(ActivatedRoute).queryParamMap.subscribe(params => {
      this.clienteId.set(Number(params.get('clienteId')) || null);
      this.carregar();
    });
  }

  carregar() {
    this.loading.set(true);
    this.error.set('');
    this.api.list(this.clienteId()).subscribe({
      next: items => { this.all.set(items); this.loading.set(false); },
      error: err => {
        this.all.set([]);
        this.error.set(err?.status === 404 ? 'Este anunciante não está na sua carteira.'
          : mensagensDoServidor(err, 'Não foi possível carregar suas campanhas.')[0]);
        this.loading.set(false);
      },
    });
  }

  criada(codigo: string) {
    this.formOpen.set(false);
    void this.router.navigate(['/anunciante/campanhas/campanha', codigo]);
  }
}
