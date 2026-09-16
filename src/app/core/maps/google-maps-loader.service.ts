import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

type GoogleMapsApi = any;

declare global {
  interface Window {
    google?: { maps?: GoogleMapsApi };
    __VEICULANDO_RUNTIME_CONFIG__?: {
      googleMapsBrowserApiKey?: string;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private readonly document = inject(DOCUMENT);
  private loading?: Promise<GoogleMapsApi>;

  load(): Promise<GoogleMapsApi> {
    if (window.google?.maps) return Promise.resolve(window.google.maps);
    if (this.loading) return this.loading;

    const apiKey = window.__VEICULANDO_RUNTIME_CONFIG__?.googleMapsBrowserApiKey?.trim();
    if (!apiKey) {
      return Promise.reject(new Error('GOOGLE_MAPS_BROWSER_API_KEY não está configurada.'));
    }

    this.loading = new Promise<GoogleMapsApi>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.id = 'google-maps-javascript-api';
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      script.onload = () => window.google?.maps
        ? resolve(window.google.maps)
        : reject(new Error('A API do Google Maps não foi inicializada.'));
      script.onerror = () => reject(new Error('Não foi possível carregar a API do Google Maps.'));
      this.document.head.appendChild(script);
    });

    return this.loading.catch((error) => {
      this.loading = undefined;
      throw error;
    });
  }
}
