import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AdvertiserAuthService } from '../../core/auth/advertiser-auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card">
      <div><h2>Entrar</h2><p class="lead">Acesse sua conta para gerenciar suas campanhas.</p></div>
      @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label>E-mail<input type="email" formControlName="email" autocomplete="email" placeholder="seu@email.com.br" /></label>
        <label>Senha<input type="password" formControlName="password" autocomplete="current-password" placeholder="••••••••" /></label>
        <a class="forgot" routerLink="/esqueci-senha">Esqueci a senha</a>
        <button class="primary-action" type="submit" [disabled]="form.invalid || loading()">{{ loading() ? 'Entrando…' : 'Entrar' }}</button>
      </form>
      <p class="switch">Ainda não tem conta? <a routerLink="/cadastre-se">Cadastre-se</a></p>
    </div>
  `,
  styleUrls: ['./auth-pages.scss']
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AdvertiserAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly loading = signal(false); readonly error = signal('');
  readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]], password: ['', [Validators.required, Validators.minLength(8)]] });
  submit() {
    if (this.form.invalid) return;
    this.loading.set(true); this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (session) => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const safeReturnUrl = returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : null;
        void this.router.navigateByUrl(safeReturnUrl ?? (session.kycStatus === 'approved' ? '/mapa' : '/kyc-status'));
      },
      error: () => this.error.set('Não foi possível entrar. Confira seus dados e tente novamente.'),
    });
  }
}
