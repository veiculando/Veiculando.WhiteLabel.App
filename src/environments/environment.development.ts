export const environment = {
  production: false,
  bffUrl: '/api/wl',
  tokenKey: 'veiculando-wl.token',
  usePrototypeFixtures: true,
  // VEI-RD-83: origem do painel da Exibidora autorizada a entregar o session
  // token de prospeccao por postMessage. Vazio desliga a entrada — e o
  // desligado e o default seguro: sem origem declarada, nenhuma janela
  // consegue abrir uma sessao sem senha neste App.
  prospeccaoOrigemPermitida: '',
  fallbackBranding: {
    nomeExibicao: 'Aurum Mídia OOH',
    logoUrl: '/assets/aurum-mark.svg',
    primaryColor: '#8a0009',
    secondaryColor: '#d9b442',
    accentColor: '#c2302c',
    footerText: 'Planeje mídia exterior com clareza.',
  },
};
