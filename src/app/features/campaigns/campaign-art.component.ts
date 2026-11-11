import { DatePipe } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ArtFormato, ArtLayout, ArtMotivo, CampaignArt, extensaoAceita, mensagensDoServidor } from './campaign.models';
import { CampaignsService } from './campaigns.service';

type Pendente = { tipo: 'motivo' | 'layout'; id: number } | null;

/**
 * VEI-RD-166b: aba Arte Final. Sub-abas Motivos e Layouts (motivo × formato), como no
 * Veiculando.Web, com upload com progresso, download e exclusão com confirmação.
 */
@Component({
  selector: 'app-campaign-art',
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./campaigns.scss', './campaign-art.scss'],
  template: `
    <section class="art" aria-label="Arte final da campanha">
      <nav class="toggle" role="tablist">
        @for (s of secoes; track s) {
          <button type="button" role="tab" [class.is-active]="secao() === s" [attr.aria-selected]="secao() === s" (click)="secao.set(s)">{{ s }}</button>
        }
      </nav>
      @if (erro()) { <p class="campaigns__error" role="alert">{{ erro() }}</p> }
      @if (loading()) { <p class="art__muted">Carregando arte final…</p> }
      @else if (dados(); as d) {
        @if (!d.podeEditar) { <p class="art__muted">Você pode ver e baixar os arquivos; só quem criou a campanha altera a arte final.</p> }

        @if (secao() === 'Motivos') {
          @if (d.podeEditar) {
            <form class="art__form" (ngSubmit)="criarMotivo()">
              <label>Nome do motivo<input name="nome" [(ngModel)]="nome" maxlength="100" required /></label>
              <label>Descrição<textarea name="descricao" [(ngModel)]="descricao" maxlength="1000" rows="2"></textarea></label>
              <button type="submit" class="primary" [disabled]="salvando() || !nome.trim()">{{ salvando() ? 'Salvando…' : 'Adicionar motivo' }}</button>
            </form>
          }
          @for (m of d.motivos; track m.id) {
            <article class="art__card">
              <span class="art__letra">{{ m.codigo }}</span>
              <div><strong>{{ m.nome }}</strong>@if (m.descricao) { <p>{{ m.descricao }}</p> }</div>
              @if (d.podeEditar) {
                @if (confirmando('motivo', m.id)) {
                  <span class="art__confirm">Excluir o motivo {{ m.codigo }}?
                    <button type="button" class="danger" (click)="excluirMotivo(m)">Excluir</button>
                    <button type="button" (click)="pendente.set(null)">Cancelar</button></span>
                } @else { <button type="button" class="ghost" (click)="pendente.set({ tipo: 'motivo', id: m.id })">Excluir</button> }
              }
            </article>
          } @empty { <p class="empty">Nenhum motivo cadastrado. Crie um motivo para enviar os layouts.</p> }
        }

        @if (secao() === 'Layouts') {
          @if (d.motivos.length === 0) { <p class="empty">Cadastre um motivo antes de enviar layouts.</p> }
          @else if (d.formatos.length === 0) { <p class="empty">A campanha ainda não tem peças com formato de arte nesta exibidora.</p> }
          @else {
            @for (m of d.motivos; track m.id) {
              <h3 class="art__motivo"><span class="art__letra">{{ m.codigo }}</span> {{ m.nome }}</h3>
              <div class="art__grid">
                @for (f of d.formatos; track f.id) {
                  @let layout = layoutDe(m.id, f.id);
                  @let chave = m.id + '-' + f.id;
                  <article class="art__cell">
                    <header><strong>{{ f.nome }}</strong> <span [class]="'midia midia--' + f.midia">{{ f.midia === 'digital' ? 'Digital' : 'Impressa' }}</span></header>
                    <p class="art__muted">{{ f.extensoes.join(', ').toUpperCase() }}@if (f.duracao) { · {{ f.duracao }} seg }</p>
                    @if (f.especificacaoCriacao || f.especificacaoArquivo) {
                      <details><summary>Especificações</summary>
                        @if (f.especificacaoCriacao) { <p>{{ f.especificacaoCriacao }}</p> }
                        @if (f.especificacaoArquivo) { <p>{{ f.especificacaoArquivo }}</p> }
                      </details>
                    }
                    @if (layout) {
                      <p class="art__file">✓ {{ layout.arquivo }} <small>{{ layout.enviadoEm | date:'dd/MM/yyyy HH:mm' }}</small></p>
                      <div class="art__actions">
                        <button type="button" class="ghost" (click)="baixar(layout)">Baixar</button>
                        @if (d.podeEditar) {
                          @if (confirmando('layout', layout.id)) {
                            <span class="art__confirm">Excluir este layout?
                              <button type="button" class="danger" (click)="excluirLayout(layout)">Excluir</button>
                              <button type="button" (click)="pendente.set(null)">Cancelar</button></span>
                          } @else { <button type="button" class="ghost" (click)="pendente.set({ tipo: 'layout', id: layout.id })">Excluir</button> }
                        }
                      </div>
                    }
                    @if (progresso()[chave] !== undefined) {
                      <progress [value]="progresso()[chave]" max="100" [attr.aria-label]="'Enviando ' + progresso()[chave] + '%'"></progress>
                    } @else if (d.podeEditar) {
                      <label class="art__upload">{{ layout ? 'Substituir arquivo' : 'Enviar arquivo' }}
                        <input type="file" [attr.accept]="accept(f)" (change)="enviar(m, f, $event)" /></label>
                    }
                    @if (erros()[chave]) { <p class="campaigns__error">{{ erros()[chave] }}</p> }
                  </article>
                }
              </div>
            }
          }
        }
      }
    </section>
  `,
})
export class CampaignArtComponent {
  private readonly api = inject(CampaignsService);
  readonly codigo = input.required<string>();
  readonly secoes = ['Motivos', 'Layouts'] as const;
  readonly secao = signal<'Motivos' | 'Layouts'>('Motivos');
  readonly dados = signal<CampaignArt | null>(null);
  readonly loading = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal('');
  readonly pendente = signal<Pendente>(null);
  readonly progresso = signal<Record<string, number>>({});
  readonly erros = signal<Record<string, string>>({});
  readonly layouts = computed(() => this.dados()?.layouts ?? []);
  nome = '';
  descricao = '';

  constructor() {
    effect(() => this.carregar(this.codigo()));
  }

  carregar(codigo = this.codigo()) {
    this.loading.set(true);
    this.api.art(codigo).subscribe({
      next: d => { this.dados.set(d); this.loading.set(false); },
      error: err => { this.erro.set(mensagensDoServidor(err, 'Não foi possível carregar a arte final.')[0]); this.loading.set(false); },
    });
  }

  layoutDe(idMotivo: number, idFormato: number): ArtLayout | undefined {
    return this.layouts().find(l => l.idMotivo === idMotivo && l.idFormato === idFormato);
  }

  confirmando(tipo: 'motivo' | 'layout', id: number) {
    const p = this.pendente();
    return p?.tipo === tipo && p.id === id;
  }

  accept(f: ArtFormato) { return f.extensoes.map(e => '.' + e).join(','); }

  criarMotivo() {
    if (!this.nome.trim()) return;
    this.salvando.set(true);
    this.erro.set('');
    this.api.createMotivo(this.codigo(), this.nome.trim(), this.descricao.trim()).subscribe({
      next: m => {
        this.dados.update(d => d && { ...d, motivos: [...d.motivos, m].sort((a, b) => a.codigo.localeCompare(b.codigo)) });
        this.nome = '';
        this.descricao = '';
        this.salvando.set(false);
      },
      error: err => { this.erro.set(mensagensDoServidor(err, 'Não foi possível criar o motivo.')[0]); this.salvando.set(false); },
    });
  }

  excluirMotivo(m: ArtMotivo) {
    this.pendente.set(null);
    this.erro.set('');
    this.api.deleteMotivo(this.codigo(), m.id).subscribe({
      next: () => this.dados.update(d => d && { ...d, motivos: d.motivos.filter(x => x.id !== m.id) }),
      error: err => this.erro.set(mensagensDoServidor(err, 'Não foi possível excluir o motivo.')[0]),
    });
  }

  enviar(m: ArtMotivo, f: ArtFormato, event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    const chave = `${m.id}-${f.id}`;
    const max = this.dados()?.tamanhoMaximo ?? 25 * 1024 * 1024;
    if (!extensaoAceita(file.name, f.extensoes)) return this.setErro(chave, `Use um arquivo ${f.extensoes.join(', ').toUpperCase()}.`);
    if (file.size > max) return this.setErro(chave, `O arquivo tem até ${Math.round(max / 1024 / 1024)} MB.`);
    this.setErro(chave, '');
    this.setProgresso(chave, 0);
    this.api.uploadLayout(this.codigo(), m.id, f.id, file).subscribe({
      next: ev => {
        if (ev.type === HttpEventType.UploadProgress) this.setProgresso(chave, Math.round(100 * ev.loaded / (ev.total || file.size || 1)));
        if (ev.type === HttpEventType.Response && ev.body) {
          const novo = ev.body;
          this.dados.update(d => d && { ...d, layouts: [...d.layouts.filter(l => !(l.idMotivo === m.id && l.idFormato === f.id)), novo] });
          this.setProgresso(chave, undefined);
        }
      },
      error: err => { this.setProgresso(chave, undefined); this.setErro(chave, mensagensDoServidor(err, 'Não foi possível enviar o arquivo.')[0]); },
    });
  }

  excluirLayout(l: ArtLayout) {
    this.pendente.set(null);
    this.api.deleteLayout(this.codigo(), l.id).subscribe({
      next: () => this.dados.update(d => d && { ...d, layouts: d.layouts.filter(x => x.id !== l.id) }),
      error: err => this.setErro(`${l.idMotivo}-${l.idFormato}`, mensagensDoServidor(err, 'Não foi possível excluir o layout.')[0]),
    });
  }

  baixar(l: ArtLayout) {
    this.api.downloadLayout(this.codigo(), l.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = l.arquivo ?? `layout-${l.id}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url));
      },
      error: err => this.setErro(`${l.idMotivo}-${l.idFormato}`, mensagensDoServidor(err, 'Não foi possível baixar o arquivo.')[0]),
    });
  }

  private setProgresso(chave: string, valor: number | undefined) {
    this.progresso.update(p => {
      const novo = { ...p };
      if (valor === undefined) delete novo[chave]; else novo[chave] = valor;
      return novo;
    });
  }

  private setErro(chave: string, msg: string) {
    this.erros.update(e => ({ ...e, [chave]: msg }));
  }
}
