import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdvertiserAuthService } from '../../core/auth/advertiser-auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card">
      @if (sent()) {
        <section class="recovery-sent" aria-live="polite">
          <span class="recovery-sent__mark" aria-hidden="true">✓</span>
          <h2>Verifique seu e-mail</h2>
          <p>Enviamos um link de recuperação para {{ form.controls.email.value }}. O link expira em 2 horas.</p>
          <a class="primary-action" routerLink="/login">Voltar ao login</a>
          <p class="resend">Não recebeu? <button type="button" (click)="resend()">Reenviar</button></p>
        </section>
      } @else if (completed()) {
        <section class="recovery-sent" aria-live="polite">
          <span class="recovery-sent__mark" aria-hidden="true">✓</span>
          <h2>Senha atualizada</h2>
          <p>Sua nova senha já pode ser usada para acessar a plataforma.</p>
          <a class="primary-action" routerLink="/login">Voltar ao login</a>
        </section>
      } @else {
        <div>
          <p class="section-label">{{ resetMode ? 'Criar nova senha' : 'Recuperar acesso' }}</p>
          <h2>{{ resetMode ? 'Escolha uma nova senha' : 'Redefina sua senha' }}</h2>
          <p class="lead">{{ resetMode ? 'Use uma senha com pelo menos 8 caracteres.' : 'Informe seu e-mail. Se houver uma conta, enviaremos as próximas instruções.' }}</p>
        </div>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>E-mail<input type="email" formControlName="email" autocomplete="email" [readonly]="resetMode" /></label>
          @if (resetMode) {
            <label>Nova senha<input type="password" formControlName="newPassword" autocomplete="new-password" /></label>
          }
          @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
          <button class="primary-action" [disabled]="form.invalid || loading()">{{ loading() ? 'Enviando…' : resetMode ? 'Alterar senha' : 'Enviar instruções' }}</button>
        </form>
        <p class="switch"><a routerLink="/login">Voltar para o acesso</a></p>
      }
    </div>
  `,
  styleUrls: ['./auth-pages.scss'],
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AdvertiserAuthService);
  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly resetMode = !!this.token && !!this.route.snapshot.queryParamMap.get('email');
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly completed = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    newPassword: [''],
  });

  constructor() {
    if (this.resetMode) this.form.controls.newPassword.addValidators([Validators.required, Validators.minLength(8)]);
  }

  submit() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true); this.error.set('');
    const value = this.form.getRawValue();
    const request = this.resetMode
      ? this.auth.resetPassword({ email: value.email, token: this.token, newPassword: value.newPassword })
      : this.auth.requestPasswordReset(value.email);
    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => this.resetMode ? this.completed.set(true) : this.sent.set(true),
      error: () => this.resetMode
        ? this.error.set('Não foi possível alterar sua senha. Solicite um novo link de recuperação.')
        : this.sent.set(true),
    });
  }

  resend() { this.sent.set(false); this.submit(); }
}
