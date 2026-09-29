import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({imports:[RouterLink],changeDetection:ChangeDetectionStrategy.OnPush,template:`<section class="onboarding-card wide"><p class="step">Etapa 1 de 3</p><h2>Como você vai anunciar?</h2><p>Escolha a organização que fará a compra de mídia.</p><div class="choice-grid"><a routerLink="/consulta-cnpj" [queryParams]="{tipo:'ad'}"><b>Anunciante direto</b><span>Para sua marca comprar diretamente da exibidora.</span></a><a routerLink="/consulta-cnpj" [queryParams]="{tipo:'ag'}"><b>Agência</b><span>Para representar anunciantes e planejar campanhas.</span></a></div></section>`,styleUrls:['./onboarding.scss']})
export class AccountTypePage{}
