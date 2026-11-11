import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { PRODUCTION_FILTERS, ProductionFilter, ProductionRow, extensoes, mensagensDoServidor } from './campaign.models';
import { CampaignsService } from './campaigns.service';

/**
 * VEI-RD-165b: aba Produção do detalhe da campanha. Mesmo conteúdo do Veiculando.Web
 * (suporte, mídia, formato, dimensão, resolução, duração, extensões e quantidade), só com peças
 * desta exibidora, que é o recorte que o BFF já devolve.
 */
@Component({
  selector: 'app-campaign-production',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./campaigns.scss', './campaign-production.scss'],
  template: `
    <section class="production" aria-label="Produção da campanha">
      <header class="production__head">
        <div class="toggle" role="group" aria-label="Status dos pedidos">
          @for (f of filtros; track f.value) {
            <button type="button" [class.is-active]="filtro() === f.value" [attr.aria-pressed]="filtro() === f.value"
              (click)="filtro.set(f.value)">{{ f.label }}</button>
          }
        </div>
        <button type="button" class="ghost" (click)="exportar()" [disabled]="exportando() || loading()">
          {{ exportando() ? 'Gerando PDF…' : 'Exportar PDF' }}
        </button>
      </header>

      @if (erro()) { <p class="campaigns__error" role="alert">{{ erro() }}</p> }
      @if (loading()) { <p class="production__loading">Carregando especificações…</p> }
      @else if (linhas().length === 0 && !erro()) {
        <p class="empty">Não existe nenhuma peça para produção nesta campanha.</p>
      } @else if (linhas().length > 0) {
        <p class="production__total"><strong>{{ total() | number:'1.0-0':'pt-BR' }}</strong> {{ total() === 1 ? 'peça' : 'peças' }} para produzir</p>
        <table class="production__table">
          <thead>
            <tr><th>Suporte</th><th>Mídia</th><th>Formato</th><th>Dimensão</th><th>Resolução</th><th>Duração</th><th>Extensões</th><th class="num">Qtd.</th></tr>
          </thead>
          <tbody>
            @for (l of linhas(); track $index) {
              <tr>
                <td data-label="Suporte"><strong>{{ l.suporte }}</strong></td>
                <td data-label="Mídia">
                  @if (l.midia) { <span [class]="'midia midia--' + l.midia">{{ l.midia === 'digital' ? 'Digital' : 'Impressa' }}</span> }
                  @else { — }
                </td>
                <td data-label="Formato">{{ l.formato ?? '—' }}</td>
                <td data-label="Dimensão">{{ l.dimensao ?? '—' }}</td>
                <td data-label="Resolução">{{ l.resolucao ?? '—' }}</td>
                <td data-label="Duração">{{ l.duracao ? l.duracao + ' seg' : '—' }}</td>
                <td data-label="Extensões">{{ ext(l.extensoesAceitas) }}</td>
                <td data-label="Quantidade" class="num">{{ l.quantidade | number:'1.0-0':'pt-BR' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
})
export class CampaignProductionComponent {
  private readonly api = inject(CampaignsService);
  readonly codigo = input.required<string>();
  readonly filtros = PRODUCTION_FILTERS;
  readonly filtro = signal<ProductionFilter>(1);
  readonly linhas = signal<ProductionRow[]>([]);
  readonly loading = signal(true);
  readonly exportando = signal(false);
  readonly erro = signal('');
  readonly total = computed(() => this.linhas().reduce((soma, l) => soma + l.quantidade, 0));
  readonly ext = extensoes;

  constructor() {
    effect(onCleanup => {
      const codigo = this.codigo();
      const filtro = this.filtro();
      this.loading.set(true);
      this.erro.set('');
      const sub = this.api.production(codigo, filtro).subscribe({
        next: linhas => { this.linhas.set(linhas); this.loading.set(false); },
        error: err => {
          this.linhas.set([]);
          this.erro.set(mensagensDoServidor(err, 'Não foi possível carregar a produção.')[0]);
          this.loading.set(false);
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  exportar() {
    this.exportando.set(true);
    this.erro.set('');
    this.api.productionPdf(this.codigo(), this.filtro()).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Producao-${this.codigo()}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url));
        this.exportando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível gerar o PDF.');
        this.exportando.set(false);
      },
    });
  }
}
