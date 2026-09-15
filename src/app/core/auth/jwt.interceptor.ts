import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SecureStorage } from './secure-storage';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  // Never send the advertiser token to an absolute/external URL.
  if (!req.url.startsWith(`${environment.bffUrl}/`)) return next(req);
  const token = SecureStorage.getToken(environment.tokenKey);

  if (!token) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  }));
};
