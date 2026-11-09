import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Observable, finalize, map } from 'rxjs';
import { AppClient, CampaignDetail, ClientsProfile, CampaignInput, mensagensDoServidor } from './campaign.models';
import { CampaignsService } from './campaigns.service';

export const VERBA_MINIMA = 1_000;
export const VERBA_MAXIMA = 100_000_000;

/** Verba opcional; quando vem, R$ 1.000–100.000.000 de 1.000 em 1.000 (mesma regra do BFF). */
export function verbaValida(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === '' || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < VERBA_MINIMA || n > VERBA_MAXIMA) return { faixa: true };
  return n % VERBA_MINIMA === 0 ? null : { passo: true };
}

function periodoValido(group: AbstractControl): ValidationErrors | null {
  const { startDate, endDate } = group.value as { startDate: string; endDate: string };
  return startDate && endDate && endDate < startDate ? { periodo: true } : null;
}

/**
 * VEI-RD-68: modal único para criar (POST checkout/context/campaigns) e editar
 * (PUT campaigns/{codigo}). Erros do servidor (`details[]` do 400) aparecem no rodapé.
 */
@Component({
  selector: 'app-campaign-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './campaigns.scss',
  template: `
    <div class="modal-backdrop" (click)="closed.emit()"></div>
    <form class="modal" role="dialog" aria-modal="true" [attr.aria-label]="titulo()" [formGroup]="form" (ngSubmit)="salvar()">
      <header><h2>{{ titulo() }}</h2><button type="button" aria-label="Fechar" (click)="closed.emit()">×</button></header>

      @if (campaign()) {
        <p class="field"><span>Anunciante</span><strong>{{ campaign()!.anunciante.nome }}</strong></p>
      } @else if (clients().length === 1) {
        <p class="field"><span>Anunciante</span><strong>{{ clients()[0].nome }}</strong></p>
      } @else {
        <label class="field">Anunciante
          <select formControlName="clientId">
            <option [ngValue]="null">Selecione o anunciante</option>
            @for (client of clients(); track client.id) { <option [ngValue]="client.id">{{ client.nome }}</option> }
          </select>
          @if (erro('clientId')) { <small>Selecione o anunciante.</small> }
        </label>
      }
      <label class="field">Campanha <input formControlName="name" maxlength="100" />
        @if (erro('name')) { <small>Informe o nome da campanha (3 a 100 caracteres).</small> }</label>
      <label class="field">Produto <input formControlName="product" maxlength="100" />
        @if (erro('product')) { <small>Informe o produto (2 a 100 caracteres).</small> }</label>
      <label class="field">Job (opcional) <input formControlName="job" maxlength="100" /></label>
      <label class="field" title="Valor planejado para a campanha. De R$ 1.000 a R$ 100.000.000, de mil em mil.">Verba (R$)
        <input type="number" formControlName="budget" [min]="min" [max]="max" [step]="min" />
        @if (erro('budget')) { <small>A verba deve ir de R$ 1.000 a R$ 100.000.000, de mil em mil.</small> }</label>
      <div class="field-row">
        <label class="field">Período de <input type="date" formControlName="startDate" />
          @if (erro('startDate')) { <small>Informe o início.</small> }</label>
        <label class="field">até <input type="date" formControlName="endDate" />
          @if (erro('endDate')) { <small>Informe o fim.</small> }</label>
      </div>
      @if (form.hasError('periodo') && (form.touched || tentou())) { <small class="field-error">O fim não pode ser antes do início.</small> }

      @if (serverErrors().length) {
        <div class="server-errors" role="alert">
          <strong>Não foi possível salvar a campanha:</strong>
          <ul>@for (msg of serverErrors(); track msg) { <li>{{ msg }}</li> }</ul>
        </div>
      }
      <footer>
        <button type="button" (click)="closed.emit()">Cancelar</button>
        <button type="submit" [disabled]="busy()">{{ busy() ? 'Salvando…' : (campaign() ? 'Salvar alterações' : 'Criar campanha') }}</button>
      </footer>
    </form>
  `,
})
export class CampaignFormComponent implements OnInit {
  private readonly api = inject(CampaignsService);
  readonly clients = input<AppClient[]>([]);
  readonly campaign = input<CampaignDetail | null>(null);
  readonly perfil = input<ClientsProfile>('anunciante_direto');
  readonly clienteAtual = input<number | null>(null);
  readonly saved = output<string>();
  readonly closed = output<void>();
  readonly busy = signal(false);
  readonly tentou = signal(false);
  readonly serverErrors = signal<string[]>([]);
  readonly min = VERBA_MINIMA;
  readonly max = VERBA_MAXIMA;

  readonly form = inject(FormBuilder).group({
    clientId: [null as number | null],
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    product: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    job: ['', Validators.maxLength(100)],
    budget: [null as number | null, verbaValida],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
  }, { validators: periodoValido });

  titulo() { return this.campaign() ? 'Editar Campanha' : 'Nova Campanha'; }

  ngOnInit() {
    const campaign = this.campaign();
    if (campaign) {
      this.form.patchValue({
        name: campaign.nome, product: campaign.produto ?? '', job: campaign.job ?? '',
        budget: campaign.budgetTotal || null,
        startDate: campaign.dataInicio?.slice(0, 10) ?? '', endDate: campaign.dataFim?.slice(0, 10) ?? '',
      });
      return;
    }
    const clients = this.clients();
    const atual = clients.length === 1 ? clients[0].id : clients.some(c => c.id === this.clienteAtual()) ? this.clienteAtual() : null;
    this.form.controls.clientId.setValue(atual);
    // Com mais de um cliente o select é obrigatório (VEI-RD-68b); anunciante direto não manda clientId.
    if (clients.length > 1) this.form.controls.clientId.addValidators(Validators.required);
    this.form.controls.clientId.updateValueAndValidity();
  }

  erro(campo: keyof typeof this.form.controls) {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || this.tentou());
  }

  salvar() {
    this.tentou.set(true);
    this.serverErrors.set([]);
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    const body: CampaignInput = {
      name: (v.name ?? '').trim(), product: (v.product ?? '').trim(), job: (v.job ?? '').trim() || undefined,
      startDate: v.startDate ?? '', endDate: v.endDate ?? '',
      budget: v.budget === null || (v.budget as unknown) === '' ? null : Number(v.budget),
    };
    const campaign = this.campaign();
    // Agência e carteira sempre dizem o cliente (o BFF exige); anunciante direto não manda.
    const clientId = this.perfil() === 'anunciante_direto' ? null : v.clientId;
    this.busy.set(true);
    const request: Observable<string> = campaign
      ? this.api.update(campaign.codigo, body).pipe(map(res => res.codigo))
      : this.api.create(body, clientId ?? null).pipe(map(res => res.code));
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: codigo => this.saved.emit(codigo),
      error: (err: unknown) => this.serverErrors.set(mensagensDoServidor(err, 'Tente novamente em instantes.')),
    });
  }
}
