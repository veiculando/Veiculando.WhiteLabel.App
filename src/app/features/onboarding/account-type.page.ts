import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({imports:[RouterLink],changeDetection:ChangeDetectionStrategy.OnPush,template:`<section class="onboarding-card wide"><p class="step">Etapa 1 de 3</p><h2>Como você vai anunciar?</h2><p>Escolha o cadastro que representa quem fará a compra de mídia.</p><div class="choice-grid"><a routerLink="/onboarding/pf"><b>Pessoa física</b><span>Para anunciar em nome próprio.</span></a><a routerLink="/consulta-cnpj"><b>Empresa</b><span>Para marcas, agências e organizações com CNPJ.</span></a></div></section>`,styleUrls:['./onboarding.scss']})
export class AccountTypePage{}
