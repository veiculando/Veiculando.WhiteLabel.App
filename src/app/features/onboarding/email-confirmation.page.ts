import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, interval } from 'rxjs';
import { AdvertiserAuthService } from '../../core/auth/advertiser-auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="onboarding-card">
    <p class="step">Confirmação de e-mail</p><h2>Confirme seu acesso</h2>
    <p>Informe o código de seis dígitos enviado ao seu e-mail. Ele expira em 15 minutos.</p>
    @if(deliveryFailed){<p role="alert">O envio inicial falhou. Aguarde um minuto e use “Reenviar código”.</p>}
    <form [formGroup]="form" (ngSubmit)="confirm()">
      <label>E-mail<input type="email" formControlName="email" autocomplete="email" /></label>
      <label>Código de confirmação<input formControlName="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" /></label>
      <button class="primary" [disabled]="form.invalid || loading()">{{loading()?'Confirmando…':'Confirmar e-mail'}}</button>
    </form>
    @if(error()){<p role="alert">{{error()}}</p>}
    @if(message()){<p role="status">{{message()}}</p>}
    <button type="button" class="secondary" [disabled]="resending() || cooldown() > 0" (click)="resend()">Reenviar código @if(cooldown()>0){({{cooldown()}}s)}</button>
    <a class="secondary" routerLink="/login">Voltar para o acesso</a>
  </section>`,
  styleUrls: ['./onboarding.scss'],
})
export class EmailConfirmationPage {
  private readonly auth = inject(AdvertiserAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly deliveryFailed = this.route.snapshot.queryParamMap.get('delivery') === 'failed';
  readonly form = inject(FormBuilder).nonNullable.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
  });
  readonly loading = signal(false);
  readonly resending = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly cooldown = signal(this.deliveryFailed ? 60 : 0);
  constructor() { interval(1000).pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => this.cooldown.update(v => Math.max(0, v - 1))); }
  confirm() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true); this.error.set('');
    const { email, code } = this.form.getRawValue();
    this.auth.confirmEmail(email.trim(), code).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => void this.router.navigate(['/tipo-conta']),
      error: () => this.error.set('Código inválido ou expirado. Confira o código ou solicite novo envio.'),
    });
  }
  resend() {
    if (this.form.controls.email.invalid || this.resending() || this.cooldown() > 0) return;
    this.resending.set(true); this.error.set('');
    this.auth.resendConfirmation(this.form.getRawValue().email.trim()).pipe(finalize(() => this.resending.set(false))).subscribe({
      next: response => { this.message.set(response.message); this.cooldown.set(60); },
      error: () => this.error.set('Não foi possível reenviar o código. Aguarde e tente novamente.'),
    });
  }
}
