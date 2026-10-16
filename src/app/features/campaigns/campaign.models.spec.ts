import { verbaDisponivel } from './campaign.models';

describe('verbaDisponivel', () => {
  it('desconta confirmado e pendente do budget', () => {
    expect(verbaDisponivel({ budgetTotal: 1000, pedidosConfirmados: 400, pedidosPendentes: 150 })).toBe(450);
  });
});
