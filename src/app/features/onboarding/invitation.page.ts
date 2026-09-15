import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { KycService } from '../../core/kyc/kyc.service';

@Component({
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="onboarding-card">
    <div class="status-symbol">✉</div><p class="step">Convite de acesso</p>
    @if (loading()) { <h2>Validando convite…</h2> }
    @else if (valid()) {
      <h2>Convite válido</h2>
      <p>Complete o cadastro para solicitar acesso à organização.</p>
      <a class="primary" routerLink="/cadastre-se" [queryParams]="{ convite: token }">Continuar cadastro</a>
    } @else {
      <h2>Convite indisponível</h2>
      <p role="alert">O link é inválido, expirou ou não pertence a esta organização. Solicite um novo convite.</p>
      <a class="secondary" routerLink="/login">Voltar para o acesso</a>
    }
  </section>`,
  styleUrls: ['./onboarding.scss'],
})
export class InvitationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly kyc = inject(KycService);
  readonly token = this.route.snapshot.paramMap.get('token') ?? '';
  readonly loading = signal(true);
  readonly valid = signal(false);

  constructor() {
    if (!this.token) { this.loading.set(false); return; }
    this.kyc.validateInvitation(this.token).subscribe({
      next: ({ valid }) => { this.valid.set(valid); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
