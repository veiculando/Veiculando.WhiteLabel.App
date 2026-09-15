import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { KycStatus } from '../../core/api/app-api.models';
import { KycService } from '../../core/kyc/kyc.service';

@Component({
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="onboarding-card">
    <div class="status-symbol">⌛</div><p class="step">Análise cadastral</p>
    @if (loading()) { <h2>Consultando seu cadastro…</h2> }
    @else if (error()) {
      <h2>Status indisponível</h2><p role="alert">{{ error() }}</p>
      <button class="primary" type="button" (click)="load()">Tentar novamente</button>
    } @else {
      <h2>{{ title() }}</h2><p>{{ message() }}</p>
      <div class="timeline"><span class="done">Dados enviados</span><span [class.done]="status()==='in_review'||status()==='approved'">Verificação</span><span [class.done]="status()==='approved'">Análise</span><span [class.done]="status()==='approved'">Cadastro liberado</span></div>
      @if(status()==='approved'){<a class="primary" routerLink="/mapa">Explorar inventário</a>}@else if(status()==='adjustments_required'){<a class="primary" routerLink="/tipo-conta">Corrigir cadastro</a>}@else{<a class="secondary" routerLink="/mapa">Explorar inventário</a>}
    }
  </section>`,
  styleUrls: ['./onboarding.scss'],
})
export class KycStatusPage {
  private readonly kyc = inject(KycService);
  readonly status = signal<KycStatus>('incomplete');
  readonly loading = signal(true);
  readonly error = signal('');
  constructor() { this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    this.kyc.status().subscribe({
      next: ({ status }) => { this.status.set(status); this.loading.set(false); },
      error: () => { this.error.set('Não foi possível verificar a análise cadastral.'); this.loading.set(false); },
    });
  }
  title() {
    switch (this.status()) {
      case 'approved': return 'Cadastro aprovado';
      case 'rejected': return 'Cadastro rejeitado';
      case 'adjustments_required': return 'Precisamos de alguns ajustes';
      case 'in_review': return 'Seu cadastro está em análise';
      case 'suspended': return 'Cadastro temporariamente suspenso';
      case 'pending': return 'Estamos analisando seus dados';
      default: return 'Cadastro incompleto';
    }
  }
  message() {
    switch (this.status()) {
      case 'approved': return 'Seu cadastro está pronto para fechar pedidos.';
      case 'rejected': return 'Este cadastro não foi aprovado. Consulte o suporte para entender os próximos passos.';
      case 'adjustments_required': return 'Revise os dados solicitados antes de enviar novamente.';
      case 'in_review': return 'Estamos verificando seus dados. Você será avisado quando a análise avançar.';
      case 'suspended': return 'O checkout permanece bloqueado enquanto o cadastro estiver suspenso.';
      case 'pending': return 'Você pode explorar o mapa. Avisaremos quando o checkout estiver liberado.';
      default: return 'Complete o cadastro para solicitar a análise.';
    }
  }
}
