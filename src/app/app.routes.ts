import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { checkoutGuard } from './core/auth/checkout.guard';
import { AuthLayoutComponent } from './layout/auth-layout.component';
import { AppShellComponent } from './layout/app-shell.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'mapa' },
  {
    path: '', component: AuthLayoutComponent, children: [
      { path: 'login', loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },
      { path: 'cadastre-se', loadComponent: () => import('./features/auth/register.page').then(m => m.RegisterPage) },
      { path: 'esqueci-senha', loadComponent: () => import('./features/auth/forgot-password.page').then(m => m.ForgotPasswordPage) },
      { path: 'confirmar-email', loadComponent: () => import('./features/onboarding/email-confirmation.page').then(m => m.EmailConfirmationPage) },
      { path: 'tipo-conta', loadComponent: () => import('./features/onboarding/account-type.page').then(m => m.AccountTypePage) },
      { path: 'consulta-cnpj', loadComponent: () => import('./features/onboarding/company-lookup.page').then(m => m.CompanyLookupPage) },
      { path: 'onboarding/:tipo', loadComponent: () => import('./features/onboarding/onboarding.page').then(m => m.OnboardingPage) },
      { path: 'kyc-status', loadComponent: () => import('./features/onboarding/kyc-status.page').then(m => m.KycStatusPage) },
      { path: 'convite/:token', loadComponent: () => import('./features/onboarding/invitation.page').then(m => m.InvitationPage) },
    ],
  },
  {
    path: '', component: AppShellComponent, canActivate: [authGuard], children: [
      { path: 'mapa', loadComponent: () => import('./features/inventory/map.page').then(m => m.MapPage) },
      { path: 'pecas/:codigo', loadComponent: () => import('./features/inventory/piece-detail.page').then(m => m.PieceDetailPage) },
      { path: 'checkout', canActivate: [checkoutGuard], loadComponent: () => import('./features/checkout/checkout.page').then(m => m.CheckoutPage) },
      { path: 'pedidos/sucesso', loadComponent: () => import('./features/checkout/success.page').then(m => m.SuccessPage) },
    ],
  },
  { path: '**', redirectTo: 'mapa' },
];
