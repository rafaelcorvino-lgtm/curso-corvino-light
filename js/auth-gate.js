/* ============================================================
 *  CORVINO COURSE — AUTH GATE
 *  ----------------------------------------------------------
 *  Senha protege as aulas: digita 1x, salva no localStorage.
 *  Senha guardada em SHA-256 (não em texto claro).
 *  Senha errada/vazia → redireciona pra /vendas/.
 *  ----------------------------------------------------------
 *  ATENÇÃO: NÃO é segurança real (devtools bypassa). É só
 *  pra evitar acesso casual / Google indexar / link compartilhado.
 *  Pra segurança real: usar Firebase Auth (planejado).
 * ============================================================ */
(function () {
  'use strict';

  // SHA-256 hash da senha "acordeon-midi-corvino-2026"
  const PASSWORD_HASH = 'd19aaa5ffb976b63f05e2f6a660ca041343f554ce21e937b4b47122dfaeeeecd';
  const STORAGE_KEY = 'corvino_auth_v1';
  const REDIRECT_URL = '/vendas/';

  // Esconde o body imediatamente — antes mesmo do conteúdo renderizar
  const hideStyle = document.createElement('style');
  hideStyle.id = 'corvino-auth-hide';
  hideStyle.textContent = 'html, body { visibility: hidden !important; }';
  (document.head || document.documentElement).appendChild(hideStyle);

  function reveal() {
    const s = document.getElementById('corvino-auth-hide');
    if (s) s.remove();
  }

  function redirectToSales() {
    window.location.href = REDIRECT_URL;
  }

  async function sha256(str) {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function checkAuth() {
    // Já autenticado nesta máquina/navegador?
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === PASSWORD_HASH) {
      reveal();
      return;
    }

    // Pede senha (prompt nativo — simples e funcional)
    const input = window.prompt(
      '🔒 ACESSO RESTRITO — Curso Corvino Light\n\n' +
      'Digite a senha do curso\n' +
      '(você recebeu por e-mail/WhatsApp após a compra):'
    );

    if (!input || !input.trim()) {
      // Cancelou ou deixou vazio → manda comprar
      redirectToSales();
      return;
    }

    const normalized = input.trim().toLowerCase();
    const hash = await sha256(normalized);

    if (hash === PASSWORD_HASH) {
      localStorage.setItem(STORAGE_KEY, hash);
      reveal();
    } else {
      alert(
        '❌ Senha incorreta.\n\n' +
        'Pra comprar o curso: https://curso.corvino.com.br/vendas/\n' +
        'Ou WhatsApp: (14) 99745-6913'
      );
      redirectToSales();
    }
  }

  // Roda assim que o documento estiver pronto pra ler o body
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
  } else {
    checkAuth();
  }
})();
