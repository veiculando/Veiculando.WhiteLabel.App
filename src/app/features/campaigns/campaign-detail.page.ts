import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CAMPAIGN_STATUS_LABEL, CampaignDetail, CampaignOrderRow, CampaignStatus, mensagensDoServidor } from './campaign.models';
import { CampaignFormComponent } from './campaign-form.component';
import { CampaignsService } from './campaigns.service';

/** Pedidos agrupados Estado → Cidade, na ordem que o BFF já devolve. */
export function agruparPedidos(rows: CampaignOrderRow[]) {
  const estados = new Map<string, Map<string, CampaignOrderRow[]>>();
  for (const row of rows) {
    const cidades = estados.get(row.estado) ?? new Map<string, CampaignOrderRow[]>();
    cidades.set(row.cidade, [...(cidades.get(row.cidade) ?? []), row]);
    estados.set(row.estado, cidades);
  }
  return [...estados].map(([estado, cidades]) => ({ estado, cidades: [...cidades].map(([cidade, pedidos]) => ({ cidade, pedidos })) }));
}

/** VEI-RD-45b/c/d/g: detalhe da campanha. Valores e permissões vêm prontos do BFF. */
@Component({
  selector: 'app-campaign-detail',
  imports: [RouterLink, CurrencyPipe, DecimalPipe, DatePipe, CampaignFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './campaigns.scss',
  template: `
    <article class="detail">
      <a routerLink="/anunciante/campanhas" [queryParams]="voltarParams()">← Voltar</a>
      @if (loading()) { <p>Carregando campanha…</p> }
      @else if (notFound()) {
        <div class="empty"><h1>Campanha não encontrada</h1><p>Ela não existe ou não está na sua carteira.</p></div>
      } @else if (error()) { <p class="campaigns__error">{{ error() }}</p> }
      @if (campaign(); as item) {
        <header class="detail__head">
          <div>
            <h1>{{ item.nome }} <span [class]="'badge badge--' + item.status">{{ label(item.status) }}</span></h1>
            <p>{{ item.anunciante.nome }} · {{ item.codigo }} · {{ item.dataInicio | date:'dd/MM/yyyy' }} – {{ item.dataFim | date:'dd/MM/yyyy' }}</p>
          </div>
          <div class="detail__actions">
            @if (item.podeEditar) { <button type="button" class="primary" (click)="editOpen.set(true)">Editar Campanha</button> }
            @if (item.podeVerRelatorio) {
              <button type="button" disabled>Relatório de Locais</button>
              <button type="button" disabled>Ver no Mapa</button>
            }
          </div>
        </header>
        <section class="money" aria-label="Valores da campanha nesta exibidora">
          <p class="money--grafite"><span>Budget total</span><strong>{{ item.budgetTotal | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></p>
          <p class="money--verde"><span>Pedidos confirmados</span><strong>{{ item.pedidosConfirmados | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></p>
          <p class="money--vinho"><span>Pedidos pendentes</span><strong>{{ item.pedidosPendentes | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></p>
          <p class="money--dourado" title="Verba menos os pedidos confirmados e pendentes nesta exibidora"><span>Verba disponível</span>
            <strong>{{ item.verbaDisponivel === null ? '—' : (item.verbaDisponivel | currency:'BRL':'symbol':'1.2-2':'pt-BR') }}</strong></p>
        </section>
        <section class="counts">
          @for (counter of counters(item); track counter.label) {
            <p><span>{{ counter.label }}</span><strong>{{ counter.value | number:'1.0-0':'pt-BR' }}</strong>
              <progress [value]="counter.value" [max]="item.totalPecas || 1"></progress></p>
          }
        </section>
        <nav class="tabs" role="tablist">
          @for (name of tabs; track name) {
            <button type="button" role="tab" [attr.aria-selected]="tab() === name" [class.is-active]="tab() === name" (click)="tab.set(name)">{{ name }}</button>
          }
        </nav>
        @switch (tab()) {
          @case ('Pedidos') {
            @for (estado of grupos(); track estado.estado) {
              <details open>
                <summary>{{ estado.estado }}</summary>
                @for (cidade of estado.cidades; track cidade.cidade) {
                  <details open>
                    <summary>{{ cidade.cidade }}</summary>
                    <table>
                      <thead><tr><th>Pedido</th><th>Período</th><th>Status</th><th>Peças</th><th>Valor</th><th></th></tr></thead>
                      <tbody>
                        @for (row of cidade.pedidos; track row.codigo) {
                          <tr>
                            <td><button type="button" class="link" disabled title="Pedido Detalhe em breve">{{ row.codigo }}</button></td>
                            <td>{{ row.periodo.dataInicio | date:'dd/MM/yyyy' }} – {{ row.periodo.dataFim | date:'dd/MM/yyyy' }}</td>
                            <td>{{ row.status }}</td>
                            <td>{{ row.pecas | number:'1.0-0':'pt-BR' }}</td>
                            <td>{{ row.valor | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
                            <td>@if (row.simulacao) { <button type="button" disabled>Excluir simulação</button> }</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </details>
                }
              </details>
            } @empty { <p class="empty">Esta campanha ainda não tem pedidos nesta exibidora.</p> }
          }
          @case ('Arte Final') { <p class="empty">Os motivos e layouts da campanha aparecerão aqui em breve.</p> }
          @case ('Produção') { <p class="empty">As especificações de produção aparecerão aqui em breve.</p> }
          @case ('Checking') {
            @switch (item.checking.estado) {
              @case ('indisponivel') { <p class="empty">O checking fica disponível quando a campanha entra em exibição.</p> }
              @case ('parcial') { <p>Campanha em checking.</p> <button type="button" disabled>Ver Checking</button> }
              @case ('concluido') { <p>Campanha veiculada.</p> <button type="button" disabled>Baixar PDF</button> }
            }
          }
          @case ('Financeiro') { <p class="empty">Documentos Financeiros</p> }
        }
        @if (editOpen()) {
          <app-campaign-form [campaign]="item" (closed)="editOpen.set(false)" (saved)="editOpen.set(false); carregar()" />
        }
      }
    </article>
  `,
})
export class CampaignDetailPage {
  private readonly api = inject(CampaignsService);
  private readonly codigo = inject(ActivatedRoute).snapshot.paramMap.get('codigo') ?? '';
  readonly campaign = signal<CampaignDetail | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly error = signal('');
  readonly editOpen = signal(false);
  readonly tab = signal('Pedidos');
  readonly tabs = ['Pedidos', 'Arte Final', 'Produção', 'Checking', 'Financeiro'];
  readonly label = (status: CampaignStatus) => CAMPAIGN_STATUS_LABEL[status] ?? status;
  readonly grupos = () => agruparPedidos(this.campaign()?.pedidos ?? []);
  readonly voltarParams = () => this.campaign() ? { clienteId: this.campaign()!.anunciante.id } : {};
  readonly counters = (item: CampaignDetail) => [
    { label: 'Total de peças', value: item.totalPecas },
    { label: 'Confirmadas', value: item.pecasConfirmadas },
    { label: 'Pendentes', value: item.pecasPendentes },
    { label: 'Publicadas', value: item.pecasPublicadas },
  ];

  constructor() { this.carregar(); }

  carregar() {
    this.loading.set(true);
    this.api.detail(this.codigo).subscribe({
      next: item => { this.campaign.set(item); this.loading.set(false); },
      error: err => {
        this.campaign.set(null);
        this.notFound.set(err?.status === 404);
        this.error.set(mensagensDoServidor(err, 'Não foi possível carregar a campanha.')[0]);
        this.loading.set(false);
      },
    });
  }
}
