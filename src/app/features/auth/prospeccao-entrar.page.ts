import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { SecureStorage } from '../../core/auth/secure-storage';

interface ResgateResposta {
  token: string;
  expiresInMinutes: number;
  email: string;
  prospeccao: boolean;
  fonteUsuarioId: number;
}

/**
 * Entrada de uma sessão de prospecção — VEI-RD-83 task c.
 *
 * O operador da Exibidora abre esta rota em nova aba; o App recebe o session token
 * e o troca por uma sessão autenticada, sem senha.
 *
 * **Por que `postMessage` e não a URL.** O card proíbe o token na URL: query string
 * entra no histórico do navegador, no `Referer` da requisição seguinte e no log de
 * qualquer proxy no caminho. Um POST de formulário também não serve — o App é uma
 * SPA servida como arquivo estático, e o corpo de um POST não chega ao JavaScript.
 * O que resta, e é o desenho correto para um handoff entre duas origens, é: esta
 * página avisa a aba que a abriu que está pronta, recebe o token por `postMessage`
 * e o gasta imediatamente. O token não toca a URL, o histórico nem o servidor
 * estático.
 *
 * **A origem é verificada nos dois sentidos.** Só se aceita mensagem da origem
 * configurada em `environment.prospeccaoOrigemPermitida`, e o aviso de "pronto" só
 * é enviado para ela — `postMessage` com `'*'` entregaria o handshake a qualquer
 * página que tivesse conseguido abrir esta aba.
 */
@Component({
  selector: 'app-prospeccao-entrar',
  imports: [],
  template: `
    <section class="prospeccao-entrar">
      @if (erro()) {
        <h1>Não foi possível abrir a sessão</h1>
        <p role="alert">{{ erro() }}</p>
        <p>Peça ao operador para iniciar a prospecção novamente.</p>
      } @else {
        <h1>Abrindo sua sessão…</h1>
        <p>Só um instante.</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      .prospeccao-entrar { padding: 48px 24px; text-align: center; }
      .prospeccao-entrar h1 { margin-bottom: 8px; }
    `,
  ],
})
export class ProspeccaoEntrarPage implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly erro = signal('');

  private ouvinte?: (evento: MessageEvent) => void;
  private expiracao?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    const origemPermitida = environment.prospeccaoOrigemPermitida;

    if (!window.opener || !origemPermitida) {
      this.erro.set('Esta página só abre a partir do painel da exibidora.');
      return;
    }

    this.ouvinte = (evento: MessageEvent) => {
      // Origem verificada antes de olhar o conteúdo: uma mensagem de qualquer
      // outra janela é descartada sem ser lida.
      if (evento.origin !== origemPermitida) return;
      if (evento.data?.type !== 'prospeccao-token') return;

      this.limpar();
      this.resgatar(evento.data.token, evento.data.operadorId, evento.data.anuncianteId ?? null);
    };

    window.addEventListener('message', this.ouvinte);

    // Se a aba que abriu nunca responder, a página não fica girando para sempre.
    this.expiracao = setTimeout(() => {
      this.limpar();
      if (!this.erro()) this.erro.set('A sessão não foi recebida a tempo.');
    }, 15000);

    window.opener.postMessage({ type: 'prospeccao-pronto' }, origemPermitida);
  }

  ngOnDestroy(): void {
    this.limpar();
  }

  private limpar(): void {
    if (this.ouvinte) window.removeEventListener('message', this.ouvinte);
    if (this.expiracao) clearTimeout(this.expiracao);
    this.ouvinte = undefined;
    this.expiracao = undefined;
  }

  private resgatar(token: string, operadorId: number, anuncianteId: number | null): void {
    this.http
      .post<ResgateResposta>(`${environment.bffUrl}/app/prospeccao/sessao`, {
        Token: token,
        OperadorId: operadorId,
        AnuncianteId: anuncianteId,
      })
      .subscribe({
        next: (sessao) => {
          SecureStorage.setToken(environment.tokenKey, sessao.token);
          // `replaceUrl`: a rota de entrada não fica no histórico, então o botão
          // "voltar" não leva a uma página que tentaria gastar um token já usado.
          this.router.navigate(['/mapa'], { replaceUrl: true });
        },
        error: (resposta) => {
          this.erro.set(resposta?.error?.message ?? 'Sessão de prospecção inválida ou expirada.');
        },
      });
  }
}
