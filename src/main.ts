import { provideZoneChangeDetection } from "@angular/core";
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {...appConfig, providers: [provideZoneChangeDetection(), ...appConfig.providers]})
  .catch((err) => {
    console.error(err);
    const fallback = document.getElementById('app-bootstrap');
    if (fallback) {
      fallback.setAttribute('role', 'alert');
      fallback.textContent = 'Não foi possível carregar a configuração desta marca. Atualize a página para tentar novamente.';
    }
  });
