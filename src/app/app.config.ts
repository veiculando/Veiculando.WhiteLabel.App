import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { JWT_OPTIONS, JwtHelperService } from '@auth0/angular-jwt';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/auth/jwt.interceptor';
import { BrandingService } from './core/branding/branding.service';

function initializeBranding(branding: BrandingService): () => Promise<void> {
  return () => branding.load();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: initializeBranding,
      deps: [BrandingService],
    },
    { provide: JWT_OPTIONS, useValue: {} },
    JwtHelperService,
  ],
};
