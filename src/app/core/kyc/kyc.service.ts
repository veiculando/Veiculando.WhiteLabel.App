import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { delay, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountType, KycStatus } from '../api/app-api.models';

export interface KycSubmission {
  accountType: AccountType;
  tradeName: string;
  legalName: string;
  document: string;
  phone: string;
  email?: string;
  website?: string;
  street: string;
  number: string;
  district: string;
  complement?: string;
  zipCode: string;
  city: string;
  state: string;
  stateTaxId?: string;
  municipalTaxId?: string;
  representativeName: string;
  representativeCpf: string;
  representativeEmail: string;
  representativePhone: string;
}

@Injectable({ providedIn: 'root' })
export class KycService {
  private readonly http = inject(HttpClient);
  lookupCompany(document: string) {
    if (environment.usePrototypeFixtures) return of({ document, legalName: 'Aurum Comércio e Serviços Ltda.', city: 'São Paulo', state: 'SP', active: true }).pipe(delay(300));
    return this.http.get<{ document: string; legalName: string; city: string; state: string; active: boolean }>(`${environment.bffUrl}/app/kyc/company/${encodeURIComponent(document)}`);
  }
  submit(payload: KycSubmission) {
    if (environment.usePrototypeFixtures) return of<{ status: KycStatus }>({ status: 'pending' }).pipe(delay(450));
    return this.http.post<{ status: KycStatus }>(`${environment.bffUrl}/app/kyc`, payload);
  }
  status() {
    if (environment.usePrototypeFixtures) return of<{ status: KycStatus; updatedAt: string; reason?: string }>({ status: 'pending', updatedAt: new Date().toISOString() });
    return this.http.get<{ status: KycStatus; updatedAt: string; reason?: string }>(`${environment.bffUrl}/app/kyc/status`);
  }

  documents() {
    if (environment.usePrototypeFixtures) return of<Array<{ id: string; name: string; type: string }>>([]);
    return this.http.get<Array<{ id: string; name: string; type: string }>>(`${environment.bffUrl}/app/kyc/documents`);
  }

  uploadDocument(type: string, file: File) {
    if (environment.usePrototypeFixtures) return of({ message: 'Documento recebido.' }).pipe(delay(300));
    const body = new FormData();
    body.append('type', type);
    body.append('file', file);
    return this.http.post<{ message: string }>(`${environment.bffUrl}/app/kyc/documents`, body);
  }

  validateInvitation(token: string) {
    if (environment.usePrototypeFixtures) return of({ valid: token.startsWith('preview-') });
    return this.http.get<{ valid: boolean }>(`${environment.bffUrl}/app/invitations/${encodeURIComponent(token)}`);
  }
}
