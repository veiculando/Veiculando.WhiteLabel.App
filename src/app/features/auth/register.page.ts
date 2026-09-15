import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AdvertiserAuthService, RegistrationPolicy } from '../../core/auth/advertiser-auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card registration" data-node-id="1:36">
      <div><h2>Criar conta</h2><p class="lead">Preencha seus dados para começar.</p></div>
      @if(error()){<p class="alert" role="alert">{{error()}}</p>}
      @if(!policy() && !loadingPolicy()){<button type="button" (click)="loadPolicy()">Tentar carregar novamente</button>}
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>Nome completo<input formControlName="name" autocomplete="name" placeholder="Seu nome" maxlength="200" /></label>
        <label>E-mail<input type="email" formControlName="email" autocomplete="email" placeholder="seu@email.com.br" maxlength="254" /></label>
        @if(policy()?.requireCorporateEmail){<small>Use o e-mail corporativo da sua organização.</small>}
        <label>Celular<input type="tel" formControlName="phone" autocomplete="tel" placeholder="(11) 90000-0000" maxlength="30" /></label>
        <label>Senha<input type="password" formControlName="password" autocomplete="new-password" placeholder="Crie uma senha" aria-describedby="password-help" /></label>
        <small id="password-help">Pelo menos 8 caracteres, com letras e números.</small>
        <label class="registration-consent"><input type="checkbox" formControlName="acceptedTerms" /> <span>Li e aceito os Termos de uso e a Política de privacidade.</span></label>
        <button class="primary-action" [disabled]="form.invalid || loading() || !policy()">{{loading()?'Criando…':'Criar conta'}}</button>
      </form>
      <p class="switch">Já tem conta? <a routerLink="/login">Entrar</a></p>
    </div>
  `,
  styleUrls: ['./auth-pages.scss'],
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AdvertiserAuthService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly loadingPolicy = signal(false);
  readonly policy = signal<RegistrationPolicy | null>(null);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.required, Validators.pattern(/^[+()\s\d.-]{10,30}$/)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[\p{L}])(?=.*[0-9]).+$/u)]],
    acceptedTerms: [false, Validators.requiredTrue],
  });
  constructor() { this.loadPolicy(); }
  loadPolicy() {
    this.loadingPolicy.set(true); this.error.set('');
    this.auth.registrationPolicy().pipe(finalize(() => this.loadingPolicy.set(false))).subscribe({
      next: policy => this.policy.set(policy),
      error: () => this.error.set('Não foi possível carregar os termos vigentes. Tente novamente.'),
    });
  }
  submit() {
    const policy = this.policy();
    if (this.form.invalid || !policy || this.loading()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const phone = value.phone.replace(/[^0-9]/g, '');
    if (phone.length < 10 || phone.length > 13 || new TextEncoder().encode(value.password).length > 72) {
      this.error.set('Confira o celular e use uma senha com até 72 bytes.'); return;
    }
    this.loading.set(true); this.error.set('');
    this.auth.register({ ...value, email: value.email.trim(), phone, termsVersion: policy.termsVersion, privacyVersion: policy.privacyVersion })
      .pipe(finalize(() => this.loading.set(false))).subscribe({
        next: () => void this.router.navigate(['/confirmar-email'], { queryParams: { email: value.email.trim() } }),
        error: () => { this.error.set('Não foi possível criar o cadastro. Revise os dados e tente novamente.'); this.policy.set(null); },
      });
  }
}
