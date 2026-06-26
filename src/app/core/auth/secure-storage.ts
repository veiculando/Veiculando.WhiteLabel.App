import * as CryptoJS from 'crypto-js';

export class SecureStorage {
  // Em produção, esta chave deve ser ofuscada ou vir via environment seguro se possível,
  // ou construída em tempo de build. Conforme ADR-WL-007, a segurança tem limites no CSR.
  private static readonly SECRET_KEY = 'Veiculando_Wl_App_Secret_CSR';

  static setToken(tokenKey: string, rawToken: string): void {
    if (!rawToken) return;
    const encryptedToken = CryptoJS.AES.encrypt(rawToken, this.SECRET_KEY).toString();
    localStorage.setItem(tokenKey, encryptedToken);
  }

  static getToken(tokenKey: string): string | null {
    const encryptedToken = localStorage.getItem(tokenKey);
    if (!encryptedToken) return null;

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedToken, this.SECRET_KEY);
      const decryptedToken = bytes.toString(CryptoJS.enc.Utf8);
      return decryptedToken || null;
    } catch (e) {
      console.error('Error decrypting token from local storage', e);
      return null;
    }
  }

  static clear(tokenKey: string): void {
    localStorage.removeItem(tokenKey);
  }
}
