import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { concatMap, from, last } from 'rxjs';
import {
  AnunciantesService, ConsultaCnpj, NovaRepresentacao, Representacao, RepresentacaoDocumentoTipo,
} from '../../core/anunciantes/anunciantes.service';
import { statusCarteira } from '../../core/carteira/carteira.service';
import { CepService } from '../../core/forms/cep.service';
import { exactDigits, formatBrazilianPhone, formatCep, formatCnpj, onlyDigits } from '../../core/forms/brazilian-fields';

export const documentosRepresentacao: Array<{ tipo: RepresentacaoDocumentoTipo; rotulo: string }> = [
  { tipo: 'representation-letter', rotulo: 'Carta de representação' },
  { tipo: 'corporate', rotulo: 'Contrato social do anunciante' },
  { tipo: 'representative', rotulo: 'Documento do responsável do anunciante' },
];

/** Comissão como o Core guarda: percentual inteiro de 0 a 30. */
export function comissaoValida(valor: unknown): boolean {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return valor !== '' && valor !== null && Number.isInteger(n) && n >= 0 && n <= 30;
}

export function mensagemErro(erro: unknown, padrao: string): string {
  const resposta = erro as HttpErrorResponse;
  if (resposta?.status === 403) return resposta.error?.message ?? 'Só agências com cadastro aprovado adicionam anunciantes.';
  return resposta?.error?.message ?? padrao;
}

export const editavel = (item: Representacao) => item.status === 'Rascunho' || item.status === 'AjustesSolicitados';

/**
 * "Adicionar anunciante" da agência (VEI-RD-67d/67j).
 *
 * A agência informa o CNPJ. Anunciante novo pede os dados do cliente; já existente, só as
 * condições. Depois anexa a carta de representação (sempre) e os documentos do anunciante e
 * envia para a análise da exibidora. Aprovado, o anunciante entra na carteira da agência.
 */
@Component({
  selector: 'app-adicionar-anunciante',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../onboarding/onboarding.scss', '../carteira/meus-clientes.page.scss'],
  template: `
    <section class="carteira">
      <header class="carteira__head">
        <div><p class="step"><a routerLink="/anunciante/clientes">Meus anunciantes</a></p><h1>Adicionar anunciante</h1>
          <p>Peça para representar um anunciante nesta exibidora. Depois da aprovação, ele aparece na sua carteira e você cria campanhas para ele.</p></div>
        @if (etapa() === 'fechado') { <button type="button" class="primary" (click)="abrir()">Novo pedido</button> }
      </header>

      @if (erro()) { <p class="alert alert--danger" role="alert">{{ erro() }}</p> }
      @if (aviso()) { <p class="alert alert--success" role="status">{{ aviso() }}</p> }

      @if (etapa() !== 'fechado') {
        <form class="card" [formGroup]="form" (ngSubmit)="etapa() === 'cnpj' ? consultar() : criar()">
          <h2>Novo pedido</h2>
          <div class="form-grid">
            <label class="full">CNPJ do anunciante<input formControlName="cnpj" inputmode="numeric" [readonly]="etapa() !== 'cnpj'" (input)="mascara('cnpj', formatCnpj)" /></label>
            @if (etapa() === 'novo') {
              <p class="hint full">Anunciante ainda não cadastrado. Informe os dados dele.</p>
              <label>Nome fantasia<input formControlName="nomeFantasia" /></label>
              <label>Razão social<input formControlName="razaoSocial" /></label>
              <label>Telefone<input formControlName="telefone" inputmode="tel" (input)="mascara('telefone', formatBrazilianPhone)" /></label>
              <label>CEP<input formControlName="cep" inputmode="numeric" (input)="mascara('cep', formatCep)" (blur)="buscarCep()" /></label>
              <label class="full">Logradouro<input formControlName="logradouro" /></label>
              <label>Número<input formControlName="numero" /></label>
              <label>Complemento<input formControlName="complemento" /></label>
              <label>Bairro<input formControlName="bairro" /></label>
              <label>Cidade<input formControlName="cidade" /></label>
              <label>UF<input formControlName="uf" maxlength="2" /></label>
              <label>Inscrição estadual (opcional)<input formControlName="inscricaoEstadual" /></label>
            }
            @if (etapa() === 'existente') {
              <p class="hint full">{{ nomeExistente() ? 'Anunciante encontrado: ' + nomeExistente() + '.' : 'Anunciante já cadastrado.' }} Informe só as condições da representação.</p>
            }
            @if (etapa() === 'novo' || etapa() === 'existente') {
              <label>Comissão da agência (%)<input formControlName="comissaoAgencia" type="number" min="0" max="30" step="1" inputmode="numeric" /></label>
              <label>Início do contrato (opcional)<input formControlName="inicioContrato" type="date" /></label>
              <label>Fim do contrato (opcional)<input formControlName="fimContrato" type="date" /></label>
              <p class="hint full">Comissão em número inteiro, de 0 a 30%. Sem datas, o contrato começa hoje e vale por 2 anos.</p>
            }
          </div>
          <div class="actions">
            <button type="button" class="secondary" (click)="fechar()">Cancelar</button>
            @if (etapa() === 'cnpj') {
              <button type="submit" class="primary" [disabled]="form.controls.cnpj.invalid || salvando()">{{ salvando() ? 'Consultando…' : 'Continuar' }}</button>
            } @else {
              <button type="submit" class="primary" [disabled]="salvando()">{{ salvando() ? 'Salvando…' : 'Salvar e anexar documentos' }}</button>
            }
          </div>
        </form>
      }

      <h2>Seus pedidos</h2>
      @if (carregando()) { <p>Carregando pedidos…</p> }
      @else if (!itens().length) { <div class="card empty"><p>Nenhum pedido ainda.</p></div> }

      @for (item of itens(); track item.id) {
        <article class="card cliente" [class.cliente--aberto]="selecionado() === item.id">
          <header>
            <div><h3>{{ item.nome || item.razaoSocial || 'Anunciante' }}</h3>
              <small>{{ cnpj(item.cnpj) }} · Comissão {{ item.comissaoAgencia }}% · {{ item.inicioContrato | date:'dd/MM/yyyy' }} a {{ item.fimContrato | date:'dd/MM/yyyy' }}</small></div>
            <span class="badge" [attr.data-status]="item.status">{{ rotulo(item) }}</span>
          </header>
          @if (item.motivo && (item.status === 'AjustesSolicitados' || item.status === 'Reprovado')) {
            <p class="motivo"><b>Motivo da exibidora:</b> {{ item.motivo }}</p>
          }
          @if (editavel(item)) {
            <div class="docs">
              @for (doc of documentos; track doc.tipo) {
                <label class="doc">{{ doc.rotulo }}{{ doc.tipo === 'representation-letter' ? ' (obrigatória)' : '' }}
                  <span>{{ anexado(item, doc.tipo) ?? 'Nenhum arquivo' }}</span>
                  <input type="file" accept="application/pdf,image/png,image/jpeg" (change)="escolher(item.id, doc.tipo, $event)" />
                </label>
              }
            </div>
            @if (item.origem === 'Solicitacao') { <p class="hint">Se o anunciante já tem cadastro aprovado na exibidora, basta a carta de representação.</p> }
            <div class="actions">
              <button type="button" class="primary" [disabled]="enviando() === item.id" (click)="enviar(item)">
                {{ enviando() === item.id ? 'Enviando…' : (item.status === 'AjustesSolicitados' ? 'Reenviar para análise' : 'Enviar para análise') }}</button>
            </div>
          }
          @if (item.status === 'PendenteAnalise') { <p class="hint">Em análise pela exibidora.</p> }
          @if (item.status === 'Aprovado') {
            <p class="hint">Representação aprovada. <a routerLink="/anunciante/campanhas" [queryParams]="{ clienteId: item.clienteId }">Ver campanhas</a></p>
          }
          @if (item.status === 'Reprovado') {
            <div class="actions"><button type="button" class="secondary" [disabled]="salvando()" (click)="refazer(item)">Pedir de novo</button></div>
          }
        </article>
      }
    </section>
  `,
})
export class AdicionarAnunciantePage implements OnInit {
  private readonly service = inject(AnunciantesService);
  private readonly cepService = inject(CepService);
  private readonly fb = inject(FormBuilder);

  readonly documentos = documentosRepresentacao;
  readonly editavel = editavel;
  readonly formatCnpj = formatCnpj;
  readonly formatCep = formatCep;
  readonly formatBrazilianPhone = formatBrazilianPhone;

  readonly etapa = signal<'fechado' | 'cnpj' | 'novo' | 'existente'>('cnpj');
  readonly nomeExistente = signal<string | null>(null);
  readonly itens = signal<Representacao[]>([]);
  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly enviando = signal<string | null>(null);
  readonly selecionado = signal<string | null>(null);
  readonly erro = signal('');
  readonly aviso = signal('');
  readonly escolhidos = signal<Record<string, Partial<Record<RepresentacaoDocumentoTipo, File>>>>({});

  readonly form = this.fb.nonNullable.group({
    cnpj: ['', [Validators.required, exactDigits([14])]],
    nomeFantasia: [''], razaoSocial: [''], telefone: [''], cep: [''], logradouro: [''], numero: [''],
    complemento: [''], bairro: [''], cidade: [''], uf: [''], inscricaoEstadual: [''],
    comissaoAgencia: [''], inicioContrato: [''], fimContrato: [''],
  });

  ngOnInit(): void { this.carregar(); }

  carregar(): void {
    this.carregando.set(true);
    this.service.listar().subscribe({
      next: itens => {
        this.itens.set(itens);
        this.carregando.set(false);
        // Quem já tem pedido abre a página na lista; o formulário fica a um clique.
        if (itens.length && this.etapa() === 'cnpj' && !this.form.controls.cnpj.value) this.etapa.set('fechado');
      },
      error: e => { this.erro.set(mensagemErro(e, 'Não foi possível carregar seus pedidos.')); this.carregando.set(false); },
    });
  }

  abrir(): void { this.form.reset(); this.erro.set(''); this.aviso.set(''); this.nomeExistente.set(null); this.etapa.set('cnpj'); }
  fechar(): void { this.form.reset(); this.etapa.set('fechado'); }

  mascara(campo: 'cnpj' | 'cep' | 'telefone', formatar: (v: string) => string): void {
    const control = this.form.controls[campo];
    control.setValue(formatar(control.value), { emitEvent: false });
  }

  buscarCep(): void {
    const cep = onlyDigits(this.form.controls.cep.value);
    if (cep.length !== 8) return;
    this.cepService.lookup(cep).subscribe({
      next: e => { if (!e.erro) this.form.patchValue({ logradouro: e.logradouro, bairro: e.bairro, cidade: e.localidade, uf: e.uf }); },
      error: () => undefined,
    });
  }

  consultar(): void {
    if (this.form.controls.cnpj.invalid) return;
    this.salvando.set(true);
    this.erro.set('');
    this.service.consultarCnpj(onlyDigits(this.form.controls.cnpj.value)).subscribe({
      next: r => { this.salvando.set(false); this.aplicar(r); },
      error: e => { this.salvando.set(false); this.erro.set(mensagemErro(e, 'Não foi possível consultar o CNPJ.')); },
    });
  }

  private aplicar(r: ConsultaCnpj): void {
    if (r.situacao === 'representado') { this.erro.set('Sua agência já representa este anunciante.'); return; }
    if (r.situacao === 'pedido') {
      this.aviso.set('Já existe um pedido para este anunciante. Acompanhe abaixo.');
      this.selecionado.set(r.representacaoId);
      this.fechar();
      return;
    }
    this.nomeExistente.set(r.situacao === 'existente' ? r.nome : null);
    this.etapa.set(r.situacao);
  }

  criar(): void {
    const v = this.form.getRawValue();
    if (!comissaoValida(v.comissaoAgencia)) { this.erro.set('Informe a comissão em número inteiro, de 0 a 30%.'); return; }
    const dados: NovaRepresentacao = {
      cnpj: onlyDigits(v.cnpj), comissaoAgencia: Number(v.comissaoAgencia),
      inicioContrato: v.inicioContrato || null, fimContrato: v.fimContrato || null,
    };
    if (this.etapa() === 'novo') Object.assign(dados, {
      nomeFantasia: v.nomeFantasia, razaoSocial: v.razaoSocial, telefone: onlyDigits(v.telefone), cep: onlyDigits(v.cep),
      logradouro: v.logradouro, numero: v.numero, complemento: v.complemento, bairro: v.bairro, cidade: v.cidade,
      uf: v.uf.trim().toUpperCase(), inscricaoEstadual: v.inscricaoEstadual,
    });
    this.salvar(dados, r => r.documentosDispensaveis
      ? 'Pedido criado. O anunciante já tem cadastro aprovado: anexe a carta de representação e envie.'
      : 'Pedido criado. Anexe os documentos e envie para análise.');
  }

  /** Pedido reprovado volta a rascunho com as mesmas condições; os documentos antigos saem. */
  refazer(item: Representacao): void {
    if (!item.cnpj) return;
    this.salvar({ cnpj: item.cnpj, comissaoAgencia: item.comissaoAgencia },
      () => 'Pedido reaberto. Anexe os documentos de novo e envie para análise.');
  }

  private salvar(dados: NovaRepresentacao, mensagem: (r: { documentosDispensaveis: boolean }) => string): void {
    this.salvando.set(true);
    this.erro.set('');
    this.aviso.set('');
    this.service.criar(dados).subscribe({
      next: r => {
        this.salvando.set(false);
        this.fechar();
        this.selecionado.set(r.id);
        this.aviso.set(mensagem(r));
        this.carregar();
      },
      error: e => { this.salvando.set(false); this.erro.set(mensagemErro(e, 'Não foi possível criar o pedido.')); },
    });
  }

  escolher(id: string, tipo: RepresentacaoDocumentoTipo, evento: Event): void {
    const arquivo = (evento.target as HTMLInputElement).files?.[0];
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) { this.erro.set('O arquivo passa de 10 MB.'); return; }
    this.escolhidos.update(m => ({ ...m, [id]: { ...m[id], [tipo]: arquivo } }));
  }

  anexado(item: Representacao, tipo: RepresentacaoDocumentoTipo): string | null {
    return this.escolhidos()[item.id]?.[tipo]?.name ?? item.documentos.find(d => d.tipo === tipo)?.nome ?? null;
  }

  /** Sobe os arquivos escolhidos, um por vez, e envia para a análise. */
  enviar(item: Representacao): void {
    const arquivos = Object.entries(this.escolhidos()[item.id] ?? {}) as Array<[RepresentacaoDocumentoTipo, File]>;
    this.enviando.set(item.id);
    this.erro.set('');
    this.aviso.set('');
    const envio = arquivos.length
      ? from(arquivos).pipe(concatMap(([tipo, arquivo]) => this.service.anexar(item.id, tipo, arquivo)), last(),
          concatMap(() => this.service.enviar(item.id)))
      : this.service.enviar(item.id);
    envio.subscribe({
      next: () => {
        this.enviando.set(null);
        this.escolhidos.update(m => { const { [item.id]: _, ...resto } = m; return resto; });
        this.aviso.set('Enviado para análise da exibidora.');
        this.carregar();
      },
      error: e => {
        this.enviando.set(null);
        this.erro.set(mensagemErro(e, 'Não foi possível enviar para análise.'));
        this.carregar();
      },
    });
  }

  rotulo(item: Representacao): string { return statusCarteira[item.status] ?? item.status; }
  cnpj(valor?: string | null): string { return valor ? formatCnpj(valor) : 'CNPJ não informado'; }
}
