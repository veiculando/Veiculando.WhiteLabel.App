import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { KycService, KycSubmission } from './kyc.service';

describe('KycService', () => {
  let service: KycService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withXhr()), provideHttpClientTesting()] });
    service = TestBed.inject(KycService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('envia conta agência e dados do responsável sem IDs comerciais escolhidos pelo navegador', () => {
    const payload: KycSubmission = {
      accountType: 'ag', tradeName: 'Agência Teste', legalName: 'Agência Teste Ltda',
      document: '11222333000181', phone: '11999999999', street: 'Rua A', number: '1',
      district: 'Centro', zipCode: '01001000', city: 'São Paulo', state: 'SP',
      representativeName: 'Responsável', representativeCpf: '52998224725',
      representativeEmail: 'responsavel@exemplo.com', representativePhone: '11999999999',
    };
    service.submit(payload).subscribe(result => expect(result.status).toBe('pending'));
    const request = http.expectOne('/api/wl/app/kyc');
    expect(request.request.body).toEqual(payload);
    expect(request.request.body).not.toHaveProperty('clientId');
    expect(request.request.body).not.toHaveProperty('agencyId');
    request.flush({ status: 'pending' });
  });

  it('envia documento KYC como multipart e lista apenas documentos da conta autenticada', () => {
    const file = new File(['%PDF-1.4'], 'contrato.pdf', { type: 'application/pdf' });
    service.uploadDocument('corporate', file).subscribe();
    const upload = http.expectOne('/api/wl/app/kyc/documents');
    expect(upload.request.body).toBeInstanceOf(FormData);
    expect((upload.request.body as FormData).get('type')).toBe('corporate');
    expect((upload.request.body as FormData).get('file')).toBe(file);
    upload.flush({ message: 'Documento recebido.' });

    service.documents().subscribe(documents => expect(documents[0].type).toBe('corporate'));
    http.expectOne('/api/wl/app/kyc/documents').flush([{ id: '1', name: 'contrato.pdf', type: 'corporate' }]);
  });
});
