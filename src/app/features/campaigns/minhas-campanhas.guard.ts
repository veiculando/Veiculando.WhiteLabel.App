import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { destinoMinhasCampanhas } from './campaign.models';
import { CampaignsService } from './campaigns.service';

/**
 * VEI-RD-67a: decide pelo GET /api/wl/app/clients se "Minhas Campanhas" abre o painel (com o
 * cliente na URL) ou o gateway. Erro do BFF deixa o painel abrir e mostrar a mensagem.
 */
export const minhasCampanhasGuard: CanActivateFn = route => {
  const router = inject(Router);
  const atual = Number(route.queryParamMap.get('clienteId')) || null;
  return inject(CampaignsService).clients().pipe(
    map(clients => {
      const destino = destinoMinhasCampanhas(clients, atual);
      if (destino.tipo === 'gateway') return router.createUrlTree(['/anunciante/clientes']);
      if (destino.clienteId === atual) return true;
      return router.createUrlTree(['/anunciante/campanhas'], { queryParams: { clienteId: destino.clienteId } });
    }),
    catchError(() => of(true)),
  );
};
