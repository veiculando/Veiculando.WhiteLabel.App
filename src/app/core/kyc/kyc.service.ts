import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { delay, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountType, KycStatus } from '../api/app-api.models';

export interface KycSubmission {
  accountType: AccountType;
  legalName: string;
  document: string;
  phone: string;
  city: string;
  state: string;
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
    if (environment.usePrototypeFixtures) return of<{ status: KycStatus; updatedAt: string }>({ status: 'pending', updatedAt: new Date().toISOString() });
    return this.http.get<{ status: KycStatus; updatedAt: string }>(`${environment.bffUrl}/app/kyc/status`);
  }

  validateInvitation(token: string) {
    if (environment.usePrototypeFixtures) return of({ valid: token.startsWith('preview-') });
    return this.http.get<{ valid: boolean }>(`${environment.bffUrl}/app/invitations/${encodeURIComponent(token)}`);
  }
}
