import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdvertiserAuthService } from './advertiser-auth.service';

export const checkoutGuard: CanActivateFn = () => {
  if (environment.usePrototypeFixtures) return true;

  const auth = inject(AdvertiserAuthService);
  const router = inject(Router);
  return auth.loadMe().pipe(
    map(user => user.kycStatus === 'approved' ? true : router.createUrlTree(['/kyc-status'])),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};
