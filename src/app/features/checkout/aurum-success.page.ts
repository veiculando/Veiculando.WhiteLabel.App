import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderConfirmation } from '../../core/api/app-api.models';

@Component({imports:[RouterLink],changeDetection:ChangeDetectionStrategy.OnPush,template:`
  <main class="aurum-success"><div class="success-check" aria-hidden="true">✓</div>
    @if(order){<p class="success-eyebrow">Pedido enviado</p><h1>{{order.prototype?'Simulação concluída':'Pedido enviado com sucesso'}}</h1><p class="success-lead">{{order.prototype?'Esta confirmação é apenas uma prévia. Nenhuma compra real foi registrada.':'Recebemos sua solicitação de compra. A equipe confirmará disponibilidade e próximos passos.'}}</p><div class="success-protocol"><span>Número do protocolo</span><strong>{{order.orderCode}}</strong><button type="button" (click)="copyCode()">Copiar</button></div><section class="success-steps"><h2>O que acontece a seguir</h2><div><span>1</span><p><strong>Análise de disponibilidade</strong><small>A equipe verifica as peças selecionadas e confirma as condições solicitadas.</small></p></div><div><span>2</span><p><strong>Contato comercial</strong><small>Você receberá os próximos passos pelos canais cadastrados.</small></p></div></section>}@else{<h1>Não há pedido nesta sessão.</h1><p>Para ver uma confirmação, conclua o checkout.</p>}
    <a routerLink="/mapa">Voltar ao mapa</a>
  </main>`})
export class AurumSuccessPage {
  readonly order=(history.state.order as OrderConfirmation|undefined)??null;
  copyCode(){if(this.order)void navigator.clipboard?.writeText(this.order.orderCode);}
}
