import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { KycStatus } from '../../core/api/app-api.models';
import { KycService } from '../../core/kyc/kyc.service';

type StepState = 'done' | 'active' | 'attention' | 'upcoming';

export function kycStepState(status: KycStatus, index: number): StepState {
  if (status === 'approved') return 'done';
  const current = status === 'pending' || status === 'adjustments_required' ? 1
    : status === 'in_review' || status === 'rejected' ? 2
    : status === 'suspended' ? 3 : 0;
  if (index < current) return 'done';
  if (index > current) return 'upcoming';
  return status === 'adjustments_required' || status === 'rejected' || status === 'suspended' ? 'attention' : 'active';
}

@Component({
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="onboarding-card">
    <p class="step">Análise cadastral</p>
    @if (loading()) { <h2>Consultando seu cadastro…</h2> }
    @else if (error()) { <h2>Status indisponível</h2><p role="alert">{{ error() }}</p><button class="primary" type="button" (click)="load()">Tentar novamente</button> }
    @else {
      <h2>{{ title() }}</h2><p>{{ message() }}</p>
      @if(reason()){<p role="status">Motivo informado pela análise: {{reason()}}</p>}
      <ol class="timeline" aria-label="Etapas da análise cadastral">
        @for (step of timeline; track step; let index = $index) {
          <li [class.done]="stepState(index)==='done'" [class.active]="stepState(index)==='active'" [class.attention]="stepState(index)==='attention'" [attr.aria-current]="stepState(index)==='active'||stepState(index)==='attention'?'step':null">{{step}}</li>
        }
      </ol>
      <button class="status-refresh" type="button" (click)="load()">Atualizar status</button>
      @if(status()==='pending'||status()==='adjustments_required'){
        <div class="kyc-documents">
          <h3>Documentos para análise</h3>
          <p>Selecione os arquivos e confira a lista antes de enviar. PDF, JPG ou PNG, até 10 MB cada.</p>
          @for(item of documentTypes;track item.type){
            <label>{{item.label}} <input #fileInput type="file" accept="application/pdf,image/jpeg,image/png" (change)="selectDocument(item.type,$event)" [disabled]="uploading()" /></label>
            @if(selectedFile(item.type); as file){<div class="selected-file"><span>{{file.name}} · {{fileSize(file)}}</span><button type="button" (click)="removeDocument(item.type,fileInput)" [disabled]="uploading()" [attr.aria-label]="'Remover '+item.label">Remover</button></div>}
            @else if(hasDocument(item.type)){<small class="document-received">Documento já recebido</small>}
          }
          @if(uploadError()){<p role="alert" class="upload-error">{{uploadError()}}</p>}
          @if(uploadMessage()){<p role="status" class="upload-success">{{uploadMessage()}}</p>}
          <button class="primary" type="button" (click)="sendDocuments()" [disabled]="!readyToSend() || uploading()">{{uploading()?'Enviando arquivos…':'Enviar documentos para análise'}}</button>
        </div>
      }
      @if(status()==='approved'){<a class="primary" routerLink="/mapa">Explorar inventário</a>}@else if(status()==='adjustments_required'){<a class="primary" routerLink="/tipo-conta">Corrigir cadastro</a>}@else{<a class="secondary" routerLink="/mapa">Explorar inventário</a>}
    }
  </section>`,
  styleUrls: ['./onboarding.scss'],
  styles: [`.kyc-documents{display:grid;gap:12px;padding:20px;border:1px solid var(--border);border-radius:14px;background:var(--white)}.kyc-documents h3,.kyc-documents p{margin:0}.kyc-documents input{width:100%;font-size:.8rem}.document-received,.upload-success{color:var(--success);font-weight:700}.selected-file{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-radius:8px;background:var(--paper-bg);font-size:.8rem;overflow-wrap:anywhere}.selected-file button,.status-refresh{border:0;background:none;color:var(--primary-color);font:inherit;font-weight:700;cursor:pointer}.status-refresh{justify-self:start;padding:0}.upload-error{color:var(--primary-color)}`],
})
export class KycStatusPage {
  private readonly kyc = inject(KycService);
  private readonly fileInputs = new Map<string, HTMLInputElement>();
  readonly status = signal<KycStatus>('incomplete');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly reason = signal('');
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly uploadMessage = signal('');
  readonly selected = signal<Record<string, File>>({});
  readonly documents = signal<Array<{ id: string; name: string; type: string }>>([]);
  readonly timeline = ['Dados enviados', 'Verificação', 'Análise', 'Cadastro liberado'];
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
  stepState(index: number) { return kycStepState(this.status(), index); }
  hasDocument(type: string) { return this.documents().some(item => item.type === type); }
  selectedFile(type: string) { return this.selected()[type] ?? null; }
  fileSize(file: File) { return `${(file.size / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`; }
  readyToSend() {
    const selected = this.selected();
    return Object.keys(selected).length > 0 && ['corporate', 'representative'].every(type => !!selected[type] || this.hasDocument(type));
  }
  private loadDocuments() { this.kyc.documents().subscribe({ next: documents => this.documents.set(documents) }); }
  selectDocument(type: string, event: Event) {
    const input = event.target as HTMLInputElement;
    this.fileInputs.set(type, input);
    const file = input.files?.[0];
    this.uploadMessage.set(''); this.uploadError.set('');
    if (!file) { this.selected.update(current => { const next = { ...current }; delete next[type]; return next; }); return; }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      this.uploadError.set('Escolha um PDF, JPG ou PNG válido de até 10 MB.');
      input.value = '';
      this.selected.update(current => { const next = { ...current }; delete next[type]; return next; });
      return;
    }
    this.selected.update(current => ({ ...current, [type]: file }));
  }
  removeDocument(type: string, input: HTMLInputElement) {
    input.value = '';
    this.selected.update(current => { const next = { ...current }; delete next[type]; return next; });
    this.uploadMessage.set('');
  }
  sendDocuments() {
    if (!this.readyToSend() || this.uploading()) return;
    const files = this.documentTypes.filter(item => this.selectedFile(item.type))
      .map(item => ({ type: item.type, file: this.selectedFile(item.type)! }));
    this.uploading.set(true); this.uploadError.set(''); this.uploadMessage.set('');
    this.kyc.uploadDocuments(files).pipe(finalize(() => this.uploading.set(false))).subscribe({
      next: () => {
        this.selected.set({});
        for (const input of this.fileInputs.values()) input.value = '';
        this.uploadMessage.set(`${files.length} ${files.length === 1 ? 'documento enviado' : 'documentos enviados'} para análise.`);
        this.loadDocuments();
      },
      error: () => {
        this.uploadError.set('Não foi possível concluir o envio. Alguns arquivos podem ter sido recebidos; confira a lista antes de tentar novamente.');
        this.loadDocuments();
      },
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
