import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { KycService } from '../../core/kyc/kyc.service';
@Component({
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="onboarding-card wide">
      <p class="step">Etapa 3 de 3</p>
      <h2>{{ accountType === 'ag' ? 'Cadastre sua agência' : 'Cadastre seu anunciante' }}</h2>
      <p>Os dados da organização e do responsável serão analisados antes de criar o vínculo comercial.</p>
      @if (error()) { <p role="alert">{{ error() }}</p> }
      <form [formGroup]="form" (ngSubmit)="submit()">
        <h3>Dados da organização</h3>
        <div class="form-grid">
          <label>Nome fantasia<input formControlName="tradeName" autocomplete="organization" /></label>
          <label>Razão social<input formControlName="legalName" /></label>
          <label>CNPJ<input formControlName="document" inputmode="numeric" /></label>
          <label>Telefone comercial<input formControlName="phone" type="tel" /></label>
          <label>E-mail comercial<input formControlName="email" type="email" /></label>
          <label>Site<input formControlName="website" type="url" /></label>
          <label>Inscrição estadual<input formControlName="stateTaxId" /></label>
          <label>Inscrição municipal<input formControlName="municipalTaxId" /></label>
        </div>
        <h3>Endereço comercial</h3>
        <div class="form-grid">
          <label>CEP<input formControlName="zipCode" inputmode="numeric" autocomplete="postal-code" /></label>
          <label>Logradouro<input formControlName="street" autocomplete="address-line1" /></label>
          <label>Número<input formControlName="number" /></label>
          <label>Bairro<input formControlName="district" /></label>
          <label>Complemento<input formControlName="complement" /></label>
          <label>Cidade<input formControlName="city" autocomplete="address-level2" /></label>
          <label>UF<input formControlName="state" maxlength="2" autocomplete="address-level1" /></label>
        </div>
        <h3>Responsável legal</h3>
        <div class="form-grid">
          <label>Nome completo<input formControlName="representativeName" autocomplete="name" /></label>
          <label>CPF<input formControlName="representativeCpf" inputmode="numeric" /></label>
          <label>E-mail<input formControlName="representativeEmail" type="email" autocomplete="email" /></label>
          <label>Telefone<input formControlName="representativePhone" type="tel" /></label>
        </div>
        <label class="consent"><input type="checkbox" formControlName="accepted" /> Confirmo que tenho poderes para representar esta organização e que os dados são verdadeiros.</label>
        <button class="primary" [disabled]="form.invalid || loading()">{{ loading() ? 'Enviando…' : 'Enviar para análise' }}</button>
      </form>
    </section>
  `,
  styleUrls: ['./onboarding.scss'],
})
export class OnboardingPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly kyc = inject(KycService);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly accountType = this.route.snapshot.paramMap.get('tipo') === 'ag' ? 'ag' : 'ad';
  private readonly company = history.state.company as { document?: string; legalName?: string; city?: string; state?: string } | undefined;
  readonly form = this.fb.nonNullable.group({
    tradeName: ['', Validators.required],
    legalName: [this.company?.legalName ?? '', [Validators.required, Validators.minLength(10)]],
    document: [this.company?.document ?? '', [Validators.required, Validators.minLength(14)]],
    phone: ['', Validators.required],
    email: ['', Validators.email],
    website: [''], stateTaxId: [''], municipalTaxId: [''],
    zipCode: ['', Validators.required], street: ['', Validators.required],
    number: ['', Validators.required], district: ['', Validators.required], complement: [''],
    city: [this.company?.city ?? '', Validators.required],
    state: [this.company?.state ?? '', [Validators.required, Validators.minLength(2)]],
    representativeName: ['', Validators.required],
    representativeCpf: ['', [Validators.required, Validators.minLength(11)]],
    representativeEmail: ['', [Validators.required, Validators.email]],
    representativePhone: ['', Validators.required],
    accepted: [false, Validators.requiredTrue],
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { accepted, ...data } = this.form.getRawValue();
    this.kyc.submit({ accountType: this.accountType, ...data }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => void this.router.navigate(['/kyc-status']),
      error: () => this.error.set('Não foi possível enviar seus dados para análise. Confira os campos e tente novamente.'),
    });
  }
}
