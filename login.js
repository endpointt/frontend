(function () {
  'use strict';

  const API = getApiBase();

  document.addEventListener('DOMContentLoaded', () => {
    // Se já logado, redireciona
    if (localStorage.getItem('agroair_token')) {
      window.location.href = 'Painel_admin.html';
      return;
    }

    bindModal();
    bindForm();
  });

  function bindModal() {
    const btnAbrir = document.getElementById('btn-acessar');
    const modal = document.getElementById('login-modal');
    const btnFechar = document.getElementById('login-fechar');

    if (btnAbrir) {
      btnAbrir.addEventListener('click', e => {
        e.preventDefault();
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('login-email').focus(), 100);
      });
    }

    if (btnFechar) {
      btnFechar.addEventListener('click', () => fechar(modal));
    }

    if (modal) {
      modal.addEventListener('click', e => { if (e.target === modal) fechar(modal); });
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal && modal.style.display !== 'none') fechar(modal);
    });
  }

  function fechar(modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function bindForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const btn = document.getElementById('login-btn');
      const erroEl = document.getElementById('login-erro');
      const email = document.getElementById('login-email').value.trim();
      const senha = document.getElementById('login-senha').value;

      if (!email || !senha) {
        erroEl.textContent = 'Preencha todos os campos';
        return;
      }

      erroEl.textContent = '';
      setBtnLoading(btn, true);

      try {
        const r = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, senha }),
        });

        const data = await r.json();

        if (!r.ok) {
          throw new Error(data.erro || 'Credenciais inválidas');
        }

        localStorage.setItem('agroair_token', data.token);
        if (data.admin?.email) localStorage.setItem('agroair_admin_email', data.admin.email);
        window.location.href = 'Painel_admin.html';
      } catch (err) {
        erroEl.textContent = err.message || 'Erro ao fazer login. Tente novamente.';
      } finally {
        setBtnLoading(btn, false);
      }
    });
  }

  function setBtnLoading(btn, loading) {
    btn.disabled = loading;
    btn.querySelector('.btn-texto').style.display = loading ? 'none' : 'inline';
    btn.querySelector('.btn-loading').style.display = loading ? 'inline' : 'none';
  }

  function getApiBase() {
    const explicit = window.AGROAIR_API_BASE || localStorage.getItem('agroair_api_base');
    const base = explicit
      ? explicit.replace(/\/+$/, '').replace(/\/api$/, '')
      : (window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin);
    return `${base}/api`;
  }

})();
