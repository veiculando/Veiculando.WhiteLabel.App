import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { concatMap, from, last } from 'rxjs';
import {
  CadastroCliente, CarteiraDocumentoTipo, CarteiraItem, CarteiraService, statusCarteira,
} from '../../core/carteira/carteira.service';
import { CepService } from '../../core/forms/cep.service';
import { exactDigits, formatBrazilianPhone, formatCep, formatCnpj, onlyDigits } from '../../core/forms/brazilian-fields';

const documentos: Array<{ tipo: CarteiraDocumentoTipo; rotulo: string }> = [
  { tipo: 'corporate', rotulo: 'Contrato social' },
  { tipo: 'representative', rotulo: 'Documento do responsável' },
];

/** Mensagem do BFF, ou o texto padrão. O 409 de CNPJ repetido já diz quem é a responsável. */
export function mensagemErro(erro: unknown, padrao: string): string {
  const resposta = erro as HttpErrorResponse;
  if (resposta?.status === 403) return 'Esta tela só funciona na Prospecção aberta pelo painel da exibidora.';
  return resposta?.error?.message ?? padrao;
}

/** Pode anexar e enviar: o BFF só aceita no rascunho ou com ajustes pedidos. */
export const editavel = (item: CarteiraItem) => item.status === 'Rascunho' || item.status === 'AjustesSolicitados';

/**
 * "Meus clientes" da vendedora na Prospecção (VEI-RD-157e).
 *
 * A vendedora cadastra o cliente (nasce em rascunho), anexa contrato social e documento do
 * responsável e envia para a análise do gestor no painel. Depois de aprovado, o cliente
 * aparece no seletor "Anunciante representado" ao criar a campanha.
 */
@Component({
  selector: 'app-meus-clientes',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../onboarding/onboarding.scss', './meus-clientes.page.scss'],
  template: `
    <section class="carteira">
      <header class="carteira__head">
        <div><p class="step">Prospecção</p><h1>Meus clientes</h1>
          <p>Cadastre seus clientes e envie os documentos. Depois da aprovação da exibidora, eles aparecem em "Anunciante representado" no mapa.</p></div>
        @if (!formAberto()) { <button type="button" class="primary" (click)="abrirForm()">Cadastrar cliente</button> }
      </header>

      @if (erro()) { <p class="alert alert--danger" role="alert">{{ erro() }}</p> }
      @if (aviso()) { <p class="alert alert--success" role="status">{{ aviso() }}</p> }

      @if (formAberto()) {
        <form class="card" [formGroup]="form" (ngSubmit)="cadastrar()">
          <h2>Novo cliente</h2>
          <p class="hint">Se o CNPJ já for cliente da exibidora, informe só o CNPJ: o pedido vira uma solicitação de carteira.</p>
          <div class="form-grid">
            <label class="full">CNPJ<input formControlName="cnpj" inputmode="numeric" (input)="mascara('cnpj', formatCnpj)" /></label>
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
          </div>
          <div class="actions">
            <button type="button" class="secondary" (click)="formAberto.set(false)">Cancelar</button>
            <button type="submit" class="primary" [disabled]="form.controls.cnpj.invalid || salvando()">{{ salvando() ? 'Salvando…' : 'Salvar e anexar documentos' }}</button>
          </div>
        </form>
      }

      @if (carregando()) { <p>Carregando carteira…</p> }
      @else if (!itens().length && !formAberto()) {
        <div class="card empty"><h2>Sua carteira está vazia</h2><p>Cadastre o primeiro cliente para vender em nome dele.</p></div>
      }

      @for (item of itens(); track item.id) {
        <article class="card cliente" [class.cliente--aberto]="selecionado() === item.id">
          <header>
            <div><h3>{{ item.nome || item.razaoSocial || 'Cliente' }}</h3>
              <small>{{ cnpj(item.cnpj) }} · {{ item.origem === 'Solicitacao' ? 'Solicitação de carteira' : 'Cadastro novo' }} · {{ item.atualizadoEm | date:'dd/MM/yyyy HH:mm' }}</small></div>
            <span class="badge" [attr.data-status]="item.status">{{ rotulo(item) }}</span>
          </header>
          @if (item.motivo && (item.status === 'AjustesSolicitados' || item.status === 'Reprovado')) {
            <p class="motivo"><b>Motivo:</b> {{ item.motivo }}</p>
          }
          @if (editavel(item)) {
            <div class="docs">
              @for (doc of documentos; track doc.tipo) {
                <label class="doc">{{ doc.rotulo }}
                  <span>{{ anexado(item, doc.tipo) ?? 'Nenhum arquivo' }}</span>
                  <input type="file" accept="application/pdf,image/png,image/jpeg" (change)="escolher(item.id, doc.tipo, $event)" />
                </label>
              }
            </div>
            <div class="actions">
              <button type="button" class="primary" [disabled]="enviando() === item.id" (click)="enviar(item)">
                {{ enviando() === item.id ? 'Enviando…' : (item.status === 'AjustesSolicitados' ? 'Reenviar para análise' : 'Enviar para análise') }}</button>
            </div>
          }
          @if (item.status === 'Aprovado') { <p class="hint">Pronto para vender. <a routerLink="/mapa">Ir ao mapa</a></p> }
          @if (item.status === 'Reprovado') {
            <div class="actions">
              <button type="button" class="secondary" [disabled]="salvando()" (click)="refazer(item)">Refazer cadastro</button>
            </div>
          }
        </article>
      }
    </section>
  `,
})
export class MeusClientesPage implements OnInit {
  private readonly service = inject(CarteiraService);
  private readonly cepService = inject(CepService);
  private readonly fb = inject(FormBuilder);

  readonly documentos = documentos;
  readonly editavel = editavel;
  readonly formatCnpj = formatCnpj;
  readonly formatCep = formatCep;
  readonly formatBrazilianPhone = formatBrazilianPhone;

  readonly itens = signal<CarteiraItem[]>([]);
  readonly carregando = signal(true);
  readonly formAberto = signal(false);
  readonly salvando = signal(false);
  readonly enviando = signal<string | null>(null);
  readonly selecionado = signal<string | null>(null);
  readonly erro = signal('');
  readonly aviso = signal('');
  /** Arquivos escolhidos e ainda não enviados, por cadastro. */
  readonly escolhidos = signal<Record<string, Partial<Record<CarteiraDocumentoTipo, File>>>>({});
  readonly pendentes = computed(() => this.itens().filter(editavel).length);

  readonly form = this.fb.nonNullable.group({
    cnpj: ['', [Validators.required, exactDigits([14])]],
    nomeFantasia: [''], razaoSocial: [''], telefone: [''], cep: [''], logradouro: [''], numero: [''],
    complemento: [''], bairro: [''], cidade: [''], uf: [''], inscricaoEstadual: [''],
  });

  ngOnInit(): void { this.carregar(); }

  carregar(): void {
    this.carregando.set(true);
    this.service.listar().subscribe({
      next: itens => { this.itens.set(itens); this.carregando.set(false); },
      error: e => { this.erro.set(mensagemErro(e, 'Não foi possível carregar a carteira.')); this.carregando.set(false); },
    });
  }

  abrirForm(): void { this.form.reset(); this.erro.set(''); this.aviso.set(''); this.formAberto.set(true); }

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

  cadastrar(): void {
    if (this.form.controls.cnpj.invalid) return;
    const v = this.form.getRawValue();
    const dados: CadastroCliente = {
      ...v, cnpj: onlyDigits(v.cnpj), telefone: onlyDigits(v.telefone), cep: onlyDigits(v.cep), uf: v.uf.trim().toUpperCase(),
    };
    this.salvando.set(true);
    this.erro.set('');
    this.service.cadastrar(dados).subscribe({
      next: r => {
        this.salvando.set(false);
        this.formAberto.set(false);
        this.selecionado.set(r.id);
        this.aviso.set(r.documentosDispensaveis
          ? 'Solicitação criada. Este cliente já tem documentos aprovados: é só enviar para análise.'
          : 'Cliente salvo. Anexe os documentos e envie para análise.');
        this.carregar();
      },
      error: e => { this.salvando.set(false); this.erro.set(mensagemErro(e, 'Não foi possível cadastrar o cliente.')); },
    });
  }

  /** VEI-SUP-40: o cadastro reprovado volta a rascunho com a mesma vendedora; os documentos antigos saem. */
  refazer(item: CarteiraItem): void {
    if (!item.cnpj) return;
    this.salvando.set(true);
    this.erro.set('');
    this.aviso.set('');
    this.service.cadastrar({ cnpj: item.cnpj }).subscribe({
      next: r => {
        this.salvando.set(false);
        this.selecionado.set(r.id);
        this.aviso.set('Cadastro reaberto. Anexe os documentos de novo e envie para análise.');
        this.carregar();
      },
      error: e => { this.salvando.set(false); this.erro.set(mensagemErro(e, 'Não foi possível refazer o cadastro.')); },
    });
  }

  escolher(id: string, tipo: CarteiraDocumentoTipo, evento: Event): void {
    const arquivo = (evento.target as HTMLInputElement).files?.[0];
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) { this.erro.set('O arquivo passa de 10 MB.'); return; }
    this.escolhidos.update(m => ({ ...m, [id]: { ...m[id], [tipo]: arquivo } }));
  }

  /** Nome do arquivo escolhido agora ou já anexado no BFF. */
  anexado(item: CarteiraItem, tipo: CarteiraDocumentoTipo): string | null {
    return this.escolhidos()[item.id]?.[tipo]?.name ?? item.documentos.find(d => d.tipo === tipo)?.nome ?? null;
  }

  /** Sobe os arquivos escolhidos, um por vez, e envia para a análise. */
  enviar(item: CarteiraItem): void {
    const arquivos = Object.entries(this.escolhidos()[item.id] ?? {}) as Array<[CarteiraDocumentoTipo, File]>;
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

  rotulo(item: CarteiraItem): string { return statusCarteira[item.status] ?? item.status; }
  cnpj(valor?: string | null): string { return valor ? formatCnpj(valor) : 'CNPJ não informado'; }
}
