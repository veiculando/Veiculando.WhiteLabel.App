import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { delay, finalize, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountType, KycStatus, SessionResponse } from '../api/app-api.models';
import { SecureStorage } from './secure-storage';

interface CurrentUser { name: string; email: string; accountType?: AccountType; kycStatus: KycStatus; }
export interface RegistrationPolicy { termsVersion: string; privacyVersion: string; requireCorporateEmail: boolean; }
export interface RegistrationRequest {
  name: string; email: string; password: string; phone: string;
  acceptedTerms: boolean; termsVersion: string; privacyVersion: string;
}

@Injectable({ providedIn: 'root' })
export class AdvertiserAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly state = signal<CurrentUser | null>(null);

  readonly user = this.state.asReadonly();
  readonly isAuthenticated = signal(!!SecureStorage.getToken(environment.tokenKey));
  readonly loggingOut = signal(false);
  readonly sessionError = signal('');

  login(email: string, password: string) {
    if (environment.usePrototypeFixtures) {
      return of<SessionResponse>({ token: prototypeToken(), expiresInMinutes: 60, name: email.split('@')[0], email, accountType: 'pj', kycStatus: 'approved' }).pipe(delay(350), tap((session) => this.applySession(session)));
    }
    return this.http.post<SessionResponse>(`${environment.bffUrl}/app/auth/login`, { email, password }).pipe(
      tap((session) => this.applySession(session)),
    );
  }

  registrationPolicy() {
    if (environment.usePrototypeFixtures) return of<RegistrationPolicy>({ termsVersion: 'preview', privacyVersion: 'preview', requireCorporateEmail: false });
    return this.http.get<RegistrationPolicy>(`${environment.bffUrl}/app/auth/policy`);
  }

  register(payload: RegistrationRequest) {
    if (environment.usePrototypeFixtures) return of({ message: 'Cadastro de protótipo criado.' }).pipe(delay(350));
    return this.http.post<{ message: string }>(`${environment.bffUrl}/app/auth/register`, payload);
  }

  confirmEmail(email: string, code: string) {
    return this.http.post<SessionResponse>(`${environment.bffUrl}/app/auth/confirm-email`, { email, code }).pipe(tap(session => this.applySession(session)));
  }

  resendConfirmation(email: string) {
    return this.http.post<{ message: string }>(`${environment.bffUrl}/app/auth/resend-confirmation`, { email });
  }

  refresh() {
    return this.http.post<SessionResponse>(`${environment.bffUrl}/app/auth/refresh`, {}).pipe(tap(session => this.applySession(session)));
  }

  requestPasswordReset(email: string) {
    if (environment.usePrototypeFixtures) return of({ message: 'Se a conta existir, as instruções serão enviadas.' }).pipe(delay(300));
    return this.http.post<{ message: string }>(`${environment.bffUrl}/app/auth/forgot-password`, { email });
  }

  resetPassword(payload: { email: string; token: string; newPassword: string }) {
    if (environment.usePrototypeFixtures) return of({ message: 'Senha alterada com sucesso. Faça login com a nova senha.' }).pipe(delay(350));
    return this.http.post<{ message: string }>(`${environment.bffUrl}/app/auth/reset-password`, payload);
  }

  loadMe() {
    return this.http.get<CurrentUser>(`${environment.bffUrl}/app/auth/me`).pipe(tap((user) => this.state.set(user)));
  }

  logout() {
    if (this.loggingOut()) return;
    this.sessionError.set('');
    if (environment.usePrototypeFixtures || !SecureStorage.getToken(environment.tokenKey)) { this.clearSession(); return; }
    this.loggingOut.set(true);
    this.http.post<void>(`${environment.bffUrl}/app/auth/logout`, {}).pipe(finalize(() => this.loggingOut.set(false))).subscribe({
      next: () => this.clearSession(),
      error: error => {
        if (error.status === 401) this.clearSession();
        else this.sessionError.set('Não foi possível encerrar a sessão no servidor. Tente novamente.');
      },
    });
  }

  private clearSession() {
    SecureStorage.clear(environment.tokenKey);
    this.state.set(null);
    this.isAuthenticated.set(false);
    void this.router.navigate(['/mapa']);
  }

  private applySession(session: SessionResponse) {
    SecureStorage.setToken(environment.tokenKey, session.token);
    this.isAuthenticated.set(true);
    this.state.set({
      name: session.name,
      email: session.email,
      accountType: session.accountType,
      kycStatus: session.kycStatus,
    });
  }
}

function prototypeToken(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, WlPerfil: 'Anunciante' }));
  return `prototype.${payload}.signature`;
}
