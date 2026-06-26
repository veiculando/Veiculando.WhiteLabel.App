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

  if (token && !jwtHelper.isTokenExpired(token)) {
    // Para a Exibidora, verificaríamos permissões aqui.
    // O App (Anunciante) é mais simples.
    return true;
  }

  // Se não tem token ou está expirado, limpa e redireciona para login
  SecureStorage.clear(tokenKey);
  router.navigate(['/login']);
  return false;
};
