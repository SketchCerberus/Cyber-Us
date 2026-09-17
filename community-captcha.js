/* Cloudflare Turnstile for Cyber-Us authentication. Only the PUBLIC site key is read
   from comunidade.html. Secret validation happens in Supabase Auth after the owner
   configures CAPTCHA there. Never place the Turnstile secret in this repository. */
(() => {
  'use strict';
  if (document.body.dataset.communityPage !== 'account') return;
  const key = document.querySelector('meta[name="cyber-us-turnstile-site-key"]')?.content.trim() || '';
  const ids = ['loginForm', 'signupForm', 'resetForm'];
  const tokens = new Map();
  const widgets = new Map();
  const status = document.getElementById('captchaSetupStatus');
  const setStatus = (pt, en) => {
    if (!status) return;
    status.hidden = false;
    status.textContent = document.documentElement.lang.startsWith('pt') ? pt : en;
    status.dataset.pt = pt;
    status.dataset.en = en;
  };
  const failClosed = (pt, en) => {
    ids.forEach(id => {
      document.getElementById(id)?.querySelectorAll('button[type="submit"]').forEach(button => { button.disabled = true; });
    });
    setStatus(pt, en);
  };
  window.CyberUsCaptcha = {
    token(formId) { return tokens.get(formId) || null; },
    reset(formId) {
      tokens.delete(formId);
      const widget = widgets.get(formId);
      if (widget !== undefined && window.turnstile) window.turnstile.reset(widget);
    },
    configured: false
  };
  if (!key || !/^[a-zA-Z0-9_-]{10,100}$/.test(key)) {
    failClosed('Cadastro e login indisponíveis até a configuração do CAPTCHA pelo administrador.', 'Sign-up and sign-in are unavailable until the administrator configures CAPTCHA.');
    return;
  }
  if (!window.turnstile) {
    failClosed('Não foi possível carregar a verificação antibots. Atualize a página ou tente outro navegador.', 'Bot verification could not load. Refresh the page or try a different browser.');
    return;
  }
  window.turnstile.ready(() => {
    try {
      ids.forEach(formId => {
        const element = document.getElementById(formId + 'Captcha');
        if (!element) throw new Error('Missing Turnstile container: ' + formId);
        const widgetId = window.turnstile.render(element, {
          sitekey: key,
          theme: 'dark',
          callback: token => { tokens.set(formId, token); },
          'expired-callback': () => { tokens.delete(formId); },
          'timeout-callback': () => { tokens.delete(formId); },
          'error-callback': () => { tokens.delete(formId); }
        });
        widgets.set(formId, widgetId);
      });
      window.CyberUsCaptcha.configured = true;
      if (status) status.hidden = true;
    } catch (error) {
      failClosed('Erro ao inicializar a verificação antibots. Tente novamente mais tarde.', 'Could not initialize bot verification. Try again later.');
    }
  });
})();
