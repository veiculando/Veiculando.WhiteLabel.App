import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CAMPAIGN_STATUS_LABEL, CampaignDetail, CampaignOrderRow, verbaDisponivel } from './campaign.models';
import { CampaignsService } from './campaigns.service';

@Component({
  selector: 'app-campaign-detail',
  imports: [RouterLink, CurrencyPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './campaigns.scss',
  template: `
    <article class="detail">
      <a routerLink="/anunciante/campanhas">Voltar</a>
      @if (error()) { <p class="campaigns__error">{{ error() }}</p> }
      @if (campaign(); as item) {
        <header class="detail__head">
          @if (item.anunciante?.logoUrl) { <img [src]="item.anunciante?.logoUrl" [alt]="item.anunciante?.nome ?? ''" /> }
          <h1>{{ item.nome }} <span class="badge">{{ label(item.status) }}</span></h1>
          <button type="button" disabled>Editar campanha</button>
          @if (item.podeVerRelatorio) {
            <a [href]="reportUrl(item.codigo)" target="_blank" rel="noopener">Relatório de locais</a>
            <a routerLink="/mapa" [queryParams]="{ campanha: item.codigo }">Ver no mapa</a>
          }
        </header>
        <section class="money">
          <p class="money--grafite"><span>Budget total</span><strong>{{ item.budgetTotal | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></p>
          <p class="money--verde"><span>Pedidos confirmados</span><strong>{{ item.pedidosConfirmados | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></p>
          <p class="money--vinho"><span>Pedidos pendentes</span><strong>{{ item.pedidosPendentes | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></p>
          <p class="money--dourado"><span>Verba disponível</span><strong>{{ available(item) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></p>
        </section>
        <section class="counts">
          @for (counter of counters(item); track counter.label) {
            <p><span>{{ counter.label }}</span><strong>{{ counter.value | number:'1.0-0':'pt-BR' }}</strong>
              <progress [value]="counter.value" [max]="item.totalPecas || 1"></progress></p>
          }
        </section>
        <nav>
          @for (name of tabs; track name) {
            <button type="button" [class.is-active]="tab() === name" (click)="tab.set(name)">{{ name }}</button>
          }
        </nav>
        @switch (tab()) {
          @case ('Pedidos') {
            @for (state of states(item.pedidos); track state) {
              <details open>
                <summary>{{ state }}</summary>
                @for (city of cities(item.pedidos, state); track city) {
                  <details>
                    <summary>{{ city }}</summary>
                    <table>
                      <tr><th>Código</th><th>Local</th><th>Período</th><th>Status</th></tr>
                      @for (row of rows(item.pedidos, state, city); track row.codigo) {
                        <tr><td>{{ row.codigo }}</td><td>{{ row.local }}</td><td>{{ row.periodo }}</td><td>{{ row.status }}</td></tr>
                      }
                    </table>
                  </details>
                }
              </details>
            }
          }
          @case ('Arte final') {
            <button type="button" [class.is-active]="art() === 'motivos'" (click)="art.set('motivos')">Motivos</button>
            <button type="button" [class.is-active]="art() === 'layouts'" (click)="art.set('layouts')">Layouts</button>
            <ul>
              @for (file of (art() === 'motivos' ? item.motivos : item.layouts); track file.nome) {
                <li>{{ file.nome }}</li>
              }
            </ul>
            <label>Enviar arquivo <input type="file" disabled /></label>
          }
          @case ('Produção') {
            <table>
              <tr><th>Peça</th><th>Formato</th><th>Medida</th><th>Material</th></tr>
              @for (spec of item.producao; track spec.peca) {
                <tr><td>{{ spec.peca }}</td><td>{{ spec.formato }}</td><td>{{ spec.medida }}</td><td>{{ spec.material }}</td></tr>
              }
            </table>
            <button type="button" (click)="print()">Exportar PDF</button>
          }
          @case ('Checking') {
            @switch (item.checking.estado) {
              @case ('indisponivel') { <p>Checking ainda indisponível.</p> }
              @case ('parcial') { <p>Checking parcial.</p> <a [href]="item.checking.pdfUrl">Ver checking</a> }
              @case ('concluido') { <p>Checking concluído.</p> <a [href]="item.checking.pdfUrl">Baixar PDF</a> }
            }
          }
          @case ('Financeiro') { <p>Documentos financeiros</p> }
        }
      }
    </article>
  `,
})
export class CampaignDetailPage {
  private readonly api = inject(CampaignsService);
  private readonly route = inject(ActivatedRoute);
  readonly campaign = signal<CampaignDetail | null>(null);
  readonly error = signal('');
  readonly tab = signal('Pedidos');
  readonly art = signal<'motivos' | 'layouts'>('motivos');
  readonly tabs = ['Pedidos', 'Arte final', 'Produção', 'Checking', 'Financeiro'];
  readonly label = (status: CampaignDetail['status']) => CAMPAIGN_STATUS_LABEL[status] ?? status;
  readonly available = verbaDisponivel;
  readonly counters = (item: CampaignDetail) => [
    { label: 'Total', value: item.totalPecas },
    { label: 'Confirmadas', value: item.pecasConfirmadas },
    { label: 'Pendentes', value: item.pecasPendentes },
    { label: 'Publicadas', value: item.pecasPublicadas },
  ];

  constructor() {
    const codigo = this.route.snapshot.paramMap.get('codigo') ?? '';
    this.api.detail(codigo).subscribe({
      next: item => this.campaign.set(item),
      error: () => this.error.set('O detalhe da campanha ainda não está disponível neste ambiente.'),
    });
  }

  reportUrl(codigo: string) {
    return `${location.origin}/api/wl/app/anunciante/campanhas/${encodeURIComponent(codigo)}/relatorio`;
  }

  states(rows: CampaignOrderRow[]) {
    return [...new Set(rows.map(row => row.estado))];
  }

  cities(rows: CampaignOrderRow[], state: string) {
    return [...new Set(rows.filter(row => row.estado === state).map(row => row.cidade))];
  }

  rows(rows: CampaignOrderRow[], state: string, city: string) {
    return rows.filter(row => row.estado === state && row.cidade === city);
  }

  print() { window.print(); }
}
