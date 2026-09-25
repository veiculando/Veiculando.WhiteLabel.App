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
      @if(reason()){<p role="status">Motivo informado pela análise: {{reason()}}</p>}
      <div class="timeline"><span class="done">Dados enviados</span><span [class.done]="status()==='in_review'||status()==='approved'">Verificação</span><span [class.done]="status()==='approved'">Análise</span><span [class.done]="status()==='approved'">Cadastro liberado</span></div>
      @if(status()==='pending'||status()==='adjustments_required'){
        <div class="kyc-documents">
          <h3>Documentos para análise</h3>
          <p>Envie o contrato social e um documento do responsável. PDF, JPG ou PNG, até 10 MB cada.</p>
          @for(item of documentTypes;track item.type){
            <label>{{item.label}} <input type="file" accept="application/pdf,image/jpeg,image/png" (change)="upload(item.type,$event)" [disabled]="uploading()" /></label>
            @if(hasDocument(item.type)){<small>Documento recebido</small>}
          }
          @if(uploadError()){<p role="alert">{{uploadError()}}</p>}
          @if(uploading()){<p role="status">Enviando documento…</p>}
        </div>
      }
      @if(status()==='approved'){<a class="primary" routerLink="/mapa">Explorar inventário</a>}@else if(status()==='adjustments_required'){<a class="primary" routerLink="/tipo-conta">Corrigir cadastro</a>}@else{<a class="secondary" routerLink="/mapa">Explorar inventário</a>}
    }
  </section>`,
  styleUrls: ['./onboarding.scss'],
  styles: ['.kyc-documents{display:grid;gap:12px;padding:20px;border:1px solid var(--border);border-radius:14px;background:var(--white)}.kyc-documents h3,.kyc-documents p{margin:0}.kyc-documents small{color:var(--success);font-weight:700}.kyc-documents input{width:100%;font-size:.8rem}'],
})
export class KycStatusPage {
  private readonly kyc = inject(KycService);
  readonly status = signal<KycStatus>('incomplete');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly reason = signal('');
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly documents = signal<Array<{ id: string; name: string; type: string }>>([]);
  readonly documentTypes = [
    { type: 'corporate', label: 'Contrato social' },
    { type: 'representative', label: 'Identificação do responsável' },
    { type: 'address', label: 'Comprovante de endereço (opcional)' },
  ];
  constructor() { this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    this.kyc.status().subscribe({
      next: ({ status, reason }) => { this.status.set(status); this.reason.set(reason ?? ''); this.loading.set(false); this.loadDocuments(); },
      error: () => { this.error.set('Não foi possível verificar a análise cadastral.'); this.loading.set(false); },
    });
  }
  hasDocument(type: string) { return this.documents().some(item => item.type === type); }
  private loadDocuments() { this.kyc.documents().subscribe({ next: documents => this.documents.set(documents) }); }
  upload(type: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadError.set(''); this.uploading.set(true);
    this.kyc.uploadDocument(type, file).subscribe({
      next: () => { this.uploading.set(false); this.loadDocuments(); input.value = ''; },
      error: () => { this.uploading.set(false); this.uploadError.set('Não foi possível enviar o documento. Confira o arquivo e tente novamente.'); },
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
