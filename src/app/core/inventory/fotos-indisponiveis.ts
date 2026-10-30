import { signal } from '@angular/core';

/**
 * Peças cuja foto não carregou. O `imageUrl` só diz que há um nome cadastrado:
 * o arquivo pode faltar no FileServer, e a tela volta ao texto de foto ausente.
 */
export class FotosIndisponiveis {
  private readonly ids = signal<ReadonlySet<number>>(new Set());

  tem(id: number): boolean {
    return this.ids().has(id);
  }

  marcar(id: number): void {
    this.ids.update(ids => new Set(ids).add(id));
  }
}
