import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { SecureStorage } from './secure-storage';
import { environment } from '../../../environments/environment';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const jwtHelper = inject(JwtHelperService);

  const tokenKey = environment.tokenKey; // 'veiculando-wl.token'
  const token = SecureStorage.getToken(tokenKey);

  try {
    if (token && !jwtHelper.isTokenExpired(token)) {
      const payload = jwtHelper.decodeToken(token) as Record<string, unknown> | null;
      if (payload?.['WlPerfil'] === 'Anunciante') return true;
    }
  } catch {
    // Tokens malformed or incompatible with this App never activate routes.
  }

  // Se não tem token ou está expirado, limpa e redireciona para login
  SecureStorage.clear(tokenKey);
  return router.createUrlTree(['/login']);
};
