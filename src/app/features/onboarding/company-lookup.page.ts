import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { KycService } from '../../core/kyc/kyc.service';
import { formatCnpj } from '../../core/forms/brazilian-fields';

@Component({
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="onboarding-card">
      <p class="step">Etapa 2 de 3</p>
      <h2>Localize sua empresa</h2>
      <p>Usaremos o CNPJ para preencher os dados públicos e reduzir erros.</p>
      <form [formGroup]="form" (ngSubmit)="lookup()">
        <label>CNPJ<input formControlName="document" inputmode="numeric" autocomplete="off" maxlength="18" placeholder="00.000.000/0000-00" (input)="formatDocument($event)" /></label>
        <button class="primary" [disabled]="loading()">{{ loading() ? 'Consultando…' : 'Consultar CNPJ' }}</button>
      </form>
      @if (error()) { <p role="alert">{{ error() }}</p> }
      @if (result(); as company) {
        <div class="company">
          <span>{{ company.active ? 'Empresa encontrada' : 'Empresa com cadastro inativo' }}</span>
          <strong>{{ company.legalName }}</strong>
          <small>{{ company.city }} · {{ company.state }}</small>
          @if (company.active) {
            <button class="primary" (click)="continue()">Confirmar empresa</button>
          } @else {
            <p role="alert">Este CNPJ consta como inativo no cadastro público. Para continuar, informe um CNPJ ativo.</p>
          }
        </div>
      }
    </section>
  `,
  styleUrls: ['./onboarding.scss'],
})
export class CompanyLookupPage {
  private readonly fb = inject(FormBuilder);
  private readonly kyc = inject(KycService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly result = signal<{ document: string; legalName: string; city: string; state: string; active: boolean } | null>(null);
  readonly form = this.fb.nonNullable.group({ document: ['', Validators.required] });

  formatDocument(event: Event) {
    this.form.controls.document.setValue(formatCnpj((event.target as HTMLInputElement).value));
    this.result.set(null);
    this.error.set('');
  }

  lookup() {
    const document = this.form.getRawValue().document;
    if (document.replace(/\D/g, '').length !== 14) {
      this.result.set(null);
      this.error.set('Informe um CNPJ com 14 dígitos.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.result.set(null);
    this.kyc.lookupCompany(document).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: company => this.result.set(company),
      error: (response: HttpErrorResponse) => {
        const message = response.status === 400 ? 'CNPJ inválido. Confira os dígitos e tente novamente.'
          : response.status === 404 ? 'CNPJ não encontrado no cadastro público.'
          : response.status === 401 ? 'Sua sessão expirou. Entre novamente para consultar o CNPJ.'
          : 'Não foi possível consultar o CNPJ agora. Tente novamente em instantes.';
        this.error.set(message);
      },
    });
  }

  continue() {
    const company = this.result();
    if (!company?.active) return;
    const tipo = this.route.snapshot.queryParamMap.get('tipo') === 'ag' ? 'ag' : 'ad';
    void this.router.navigate(['/onboarding', tipo], { state: { company } });
  }
}
