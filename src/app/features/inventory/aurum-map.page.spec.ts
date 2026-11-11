import { campaignErrorMessage, distanceMeters, recommendationList, supportIcon } from './aurum-map.page';

describe('mapa Aurum', () => {
  it('mostra o motivo do BFF quando a criação de campanha é recusada (VEI-SUP-46)', () => {
    expect(campaignErrorMessage({ error: { message: 'Não foi possível salvar a campanha.', details: ['A verba deve ser múltipla de R$ 1.000.'] } }))
      .toBe('A verba deve ser múltipla de R$ 1.000.');
    expect(campaignErrorMessage({ error: { message: 'O contrato com este anunciante não está vigente.' } }))
      .toBe('O contrato com este anunciante não está vigente.');
    expect(campaignErrorMessage({})).toContain('Não foi possível criar a campanha');
  });

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

  it('mostra somente recomendadas na lista sem remover as outras do mapa até ativar o botão', () => {
    const points = [{ id: 1, recommended: true }, { id: 2, recommended: false }];
    expect(recommendationList(points as never, true).map(point => point.id)).toEqual([1]);
    expect(recommendationList(points as never, false).map(point => point.id)).toEqual([1, 2]);
  });
});
