import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { KycService } from '../../core/kyc/kyc.service';
import { KycStatusPage, kycStepState } from './kyc-status.page';

describe('status do KYC', () => {
  it('avança o stepper conforme o status e destaca ajustes sem sinalizar aprovação', () => {
    expect([0, 1, 2, 3].map(index => kycStepState('pending', index))).toEqual(['done', 'active', 'upcoming', 'upcoming']);
    expect([0, 1, 2, 3].map(index => kycStepState('in_review', index))).toEqual(['done', 'done', 'active', 'upcoming']);
    expect([0, 1, 2, 3].map(index => kycStepState('adjustments_required', index))).toEqual(['attention', 'upcoming', 'upcoming', 'upcoming']);
    expect([0, 1, 2, 3].map(index => kycStepState('approved', index))).toEqual(['done', 'done', 'done', 'done']);
  });

  it('seleciona antes de enviar e faz somente uma chamada com os arquivos escolhidos', () => {
    const uploadDocuments = vi.fn().mockReturnValue(of({ received: ['corporate', 'representative'] }));
    TestBed.configureTestingModule({
      imports: [KycStatusPage], providers: [provideRouter([]), { provide: KycService, useValue: {
        status: () => of({ status: 'pending', updatedAt: new Date().toISOString() }),
        documents: () => of([]), uploadDocuments,
      } }],
    });
    const fixture = TestBed.createComponent(KycStatusPage);
    const page = fixture.componentInstance;
    const select = (type: string, file: File) => {
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [file] });
      page.selectDocument(type, { target: input } as unknown as Event);
    };
    expect(page.readyToSend()).toBe(false);
    select('corporate', new File(['%PDF-1.4'], 'contrato.pdf', { type: 'application/pdf' }));
    expect(uploadDocuments).not.toHaveBeenCalled();
    expect(page.readyToSend()).toBe(false);
    select('representative', new File(['%PDF-1.4'], 'identidade.pdf', { type: 'application/pdf' }));
    expect(page.readyToSend()).toBe(true);
    page.sendDocuments();
    expect(uploadDocuments).toHaveBeenCalledTimes(1);
    expect(uploadDocuments.mock.calls[0][0].map((item: { type: string }) => item.type)).toEqual(['corporate', 'representative']);
    expect(page.uploadMessage()).toContain('2 documentos enviados');
    fixture.destroy();
  });

  it('mantém os dados como rascunho até o envio dos documentos obrigatórios', () => {
    TestBed.configureTestingModule({
      imports: [KycStatusPage], providers: [provideRouter([]), { provide: KycService, useValue: {
        status: () => of({ status: 'incomplete', step: 4, updatedAt: new Date().toISOString() }),
        documents: () => of([]), uploadDocuments: () => of({ received: [] }),
      } }],
    });
    const fixture = TestBed.createComponent(KycStatusPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.showDocumentForm()).toBe(true);
    expect(fixture.componentInstance.title()).toContain('Envie seus documentos');
    expect([0, 1, 2, 3].map(index => fixture.componentInstance.stepState(index))).toEqual(['active', 'upcoming', 'upcoming', 'upcoming']);
    fixture.destroy();
  });
});
