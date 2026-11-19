import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AdvertiserAuthService } from './advertiser-auth.service';

describe('AdvertiserAuthService.syncKycStatus (VEI-SUP-48)', () => {
  it('atualiza o KYC da sessão aberta com o status consultado depois', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const auth = TestBed.inject(AdvertiserAuthService);
    auth.loadMe().subscribe();
    TestBed.inject(HttpTestingController).expectOne(`${environment.bffUrl}/app/auth/me`).flush({ name: 'C', email: 'c@x.com', kycStatus: 'pending' });
    auth.syncKycStatus('approved');
    expect(auth.user()).toEqual({ name: 'C', email: 'c@x.com', kycStatus: 'approved' });
  });

  it('não cria sessão quando não há usuário carregado', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const auth = TestBed.inject(AdvertiserAuthService);
    auth.syncKycStatus('approved');
    expect(auth.user()).toBeNull();
  });
});
