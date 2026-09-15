import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderConfirmation } from '../../core/api/app-api.models';
@Component({imports:[CurrencyPipe,RouterLink],changeDetection:ChangeDetectionStrategy.OnPush,template:`<main class="success-page"><div class="success-mark">✓</div>@if(order){<p class="step">{{order.prototype?'Demonstração concluída':'Pedido enviado'}}</p><h1>{{order.prototype?'Você simulou um pedido.':'Recebemos seu pedido.'}}</h1><p>{{order.prototype?'Esta confirmação é apenas uma prévia. Nenhuma compra real foi registrada.':'Acompanhe a confirmação pelo e-mail cadastrado.'}}</p><div class="receipt"><span>Protocolo</span><strong>{{order.orderCode}}</strong><span>Valor confirmado</span><strong>{{order.total|currency:'BRL':'symbol':'1.0-0':'pt-BR'}}</strong></div>}@else{<h1>Não há pedido nesta sessão.</h1><p>Para ver uma confirmação, conclua o checkout.</p>}<a routerLink="/mapa">Voltar ao mapa</a></main>`})
export class SuccessPage{readonly order=(history.state.order as OrderConfirmation|undefined)??null;}
