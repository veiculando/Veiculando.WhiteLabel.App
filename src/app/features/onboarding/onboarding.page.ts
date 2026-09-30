import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, distinctUntilChanged, finalize, map, of, switchMap, timer } from 'rxjs';
import { KycService } from '../../core/kyc/kyc.service';
import { CepService } from '../../core/forms/cep.service';
import { exactDigits, formatBrazilianPhone, formatCep, formatCnpj, formatCpf, onlyDigits } from '../../core/forms/brazilian-fields';
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
          <label>Nome fantasia<input formControlName="tradeName" autocomplete="organization" maxlength="200" /></label>
          <label>Razão social<input formControlName="legalName" maxlength="200" /></label>
          <label>CNPJ<input formControlName="document" inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00" (input)="mask('document', $event)" /></label>
          <label>Telefone comercial<input formControlName="phone" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="15" placeholder="(11) 3000-0000" (input)="mask('phone', $event)" /></label>
          <label>E-mail comercial<input formControlName="email" type="email" maxlength="254" /></label>
          <label>Site<input formControlName="website" type="url" maxlength="255" /></label>
          <label>Inscrição estadual<input formControlName="stateTaxId" maxlength="30" /></label>
          <label>Inscrição municipal<input formControlName="municipalTaxId" maxlength="30" /></label>
        </div>
        <h3>Endereço comercial</h3>
        <div class="form-grid">
          <label>CEP<input formControlName="zipCode" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000" (input)="mask('zipCode', $event)" /></label>
          @if (cepLoading()) { <p class="cep-feedback" role="status">Buscando endereço…</p> }
          @if (cepError()) { <p class="cep-feedback" role="alert">{{cepError()}}</p> }
          <label>Logradouro<input formControlName="street" autocomplete="address-line1" maxlength="200" /></label>
          <label>Número<input formControlName="number" autocomplete="address-line2" maxlength="30" /></label>
          <label>Bairro<input formControlName="district" maxlength="100" /></label>
          <label>Complemento<input formControlName="complement" maxlength="100" /></label>
          <label>Cidade<input formControlName="city" autocomplete="address-level2" maxlength="100" /></label>
          <label>UF<input formControlName="state" maxlength="2" autocomplete="address-level1" (input)="uppercaseState($event)" /></label>
        </div>
        <h3>Responsável legal</h3>
        <div class="form-grid">
          <label>Nome completo<input formControlName="representativeName" autocomplete="name" maxlength="200" /></label>
          <label>CPF<input formControlName="representativeCpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" (input)="mask('representativeCpf', $event)" /></label>
          <label>E-mail<input formControlName="representativeEmail" type="email" autocomplete="email" maxlength="254" /></label>
          <label>Telefone<input formControlName="representativePhone" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="15" placeholder="(11) 90000-0000" (input)="mask('representativePhone', $event)" /></label>
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
  private readonly cep = inject(CepService);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly cepLoading = signal(false);
  readonly cepError = signal('');
  readonly accountType = this.route.snapshot.paramMap.get('tipo') === 'ag' ? 'ag' : 'ad';
  private readonly company = history.state?.company as { document?: string; legalName?: string; city?: string; state?: string } | undefined;
  readonly form = this.fb.nonNullable.group({
    tradeName: ['', Validators.required],
    legalName: [this.company?.legalName ?? '', [Validators.required, Validators.minLength(10)]],
    document: [formatCnpj(this.company?.document ?? ''), [Validators.required, exactDigits([14])]],
    phone: ['', [Validators.required, exactDigits([10, 11])]],
    email: ['', Validators.email],
    website: [''], stateTaxId: [''], municipalTaxId: [''],
    zipCode: ['', [Validators.required, exactDigits([8])]], street: ['', Validators.required],
    number: ['', Validators.required], district: ['', Validators.required], complement: [''],
    city: [this.company?.city ?? '', Validators.required],
    state: [this.company?.state ?? '', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    representativeName: ['', Validators.required],
    representativeCpf: ['', [Validators.required, exactDigits([11])]],
    representativeEmail: ['', [Validators.required, Validators.email]],
    representativePhone: ['', [Validators.required, exactDigits([10, 11])]],
    accepted: [false, Validators.requiredTrue],
  });

  constructor() {
    this.form.controls.zipCode.valueChanges.pipe(
      map(onlyDigits), distinctUntilChanged(),
      switchMap(zip => {
        this.cepError.set('');
        if (zip.length !== 8) { this.cepLoading.set(false); return of(null); }
        const before = this.form.getRawValue();
        return timer(300).pipe(
          switchMap(() => {
            this.cepLoading.set(true);
            return this.cep.lookup(zip).pipe(
              map(address => ({ address, before })),
              catchError(() => of({ address: null, before })),
            );
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      this.cepLoading.set(false);
      if (!result) return;
      if (!result.address || result.address.erro) {
        this.cepError.set('CEP não encontrado agora. Confira o número ou preencha o endereço manualmente.');
        return;
      }
      const { address, before } = result;
      const updates: Partial<ReturnType<typeof this.form.getRawValue>> = {};
      if (this.form.controls.street.value === before.street && address.logradouro) updates.street = address.logradouro;
      if (this.form.controls.district.value === before.district && address.bairro) updates.district = address.bairro;
      if (this.form.controls.city.value === before.city && address.localidade) updates.city = address.localidade;
      if (this.form.controls.state.value === before.state && address.uf) updates.state = address.uf;
      this.form.patchValue(updates);
    });
  }

  mask(field: 'document' | 'phone' | 'zipCode' | 'representativeCpf' | 'representativePhone', event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    const format = field === 'document' ? formatCnpj : field === 'zipCode' ? formatCep
      : field === 'representativeCpf' ? formatCpf : formatBrazilianPhone;
    this.form.controls[field].setValue(format(raw));
  }

  uppercaseState(event: Event) {
    this.form.controls.state.setValue((event.target as HTMLInputElement).value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase());
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { accepted, ...data } = this.form.getRawValue();
    this.kyc.submit({
      accountType: this.accountType, ...data,
      document: onlyDigits(data.document), phone: onlyDigits(data.phone), zipCode: onlyDigits(data.zipCode),
      representativeCpf: onlyDigits(data.representativeCpf), representativePhone: onlyDigits(data.representativePhone),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => void this.router.navigate(['/kyc-status']),
      error: () => this.error.set('Não foi possível enviar seus dados para análise. Confira os campos e tente novamente.'),
    });
  }
}
