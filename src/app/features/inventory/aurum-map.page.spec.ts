import { distanceMeters, supportIcon } from './aurum-map.page';

describe('mapa Aurum', () => {
  it('filtra peças pela distância geográfica ao POI', () => {
    const poi = { latitude: -23.5505, longitude: -46.6333 };
    expect(distanceMeters(poi, poi)).toBe(0);
    expect(distanceMeters(poi, { latitude: -23.56, longitude: -46.64 })).toBeLessThan(5000);
    expect(distanceMeters(poi, { latitude: -23.7, longitude: -46.9 })).toBeGreaterThan(5000);
  });

  it('usa os ícones originais por tipo de suporte do Veiculando.Web', () => {
    expect(supportIcon('Painel LED')).toBe('icon_painel-led.png');
    expect(supportIcon('Abrigo de ônibus')).toBe('icon_abrigo-onibus.png');
    expect(supportIcon('Relógio urbano')).toBe('icon_relogio-rua.png');
    expect(supportIcon('Outdoor premium')).toBe('icon_outdoor-special.png');
    expect(supportIcon('Empena')).toBe('icon_empena.png');
  });
});
