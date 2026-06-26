import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SecureStorage } from './secure-storage';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenKey = environment.tokenKey;
  const token = SecureStorage.getToken(tokenKey);
  
  let headers = req.headers.set('X-Tenant-AfiliadaId', environment.afiliadaId.toString());
  
  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  
  const authReq = req.clone({ headers });
  return next(authReq);
};
