export {};

declare global {
  interface Window {
    google?: { maps?: any };
    __VEICULANDO_RUNTIME_CONFIG__?: {
      googleMapsBrowserApiKey?: string;
      prospeccaoAllowedOrigins?: readonly string[];
    };
  }
}
