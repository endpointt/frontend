(function () {
  'use strict';

  const API = getApiBase();
  let appConfig = { nome_empresa: 'AgroAir', whatsapp: '', mensagem_whatsapp: '' };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await carregarConfig();
    await carregarProdutos();
    bindFiltros();
    bindCategorias();
    injetarModal();
  }

  // ── CONFIG ──────────────────────────────────────────

  async function carregarConfig() {
    try {
      const r = await fetch(`${API}/config`);
      if (!r.ok) throw 0;
      appConfig = await r.json();
      document.querySelectorAll('[data-empresa]').forEach(n => {
        n.textContent = appConfig.nome_empresa || 'AgroAir';
      });
      aplicarConfigVisual();
    } catch { /* usa defaults */ }
  }

  // ── PRODUTOS ────────────────────────────────────────

  async function carregarProdutos(filtros = {}) {
    const grid = document.getElementById('grid-produtos');
    if (!grid) return;

    grid.innerHTML = gerarSkeletons(6);

    const params = new URLSearchParams();
    ['busca', 'linha', 'categoria', 'marca', 'tipo_maquina', 'status'].forEach(k => {
      if (filtros[k]) params.set(k, filtros[k]);
    });

    try {
      const r = await fetch(`${API}/produtos?${params}`);
      if (!r.ok) throw new Error();
      let data = await r.json();

      if (filtros.preco) data = filtrarPreco(data, filtros.preco);

      if (!data.length) {
        grid.innerHTML = `<div class="estado-msg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <p>Nenhum produto encontrado</p>
          <span>Ajuste os filtros ou tente outra busca</span>
        </div>`;
        return;
      }

      renderizar(grid, data);
    } catch {
      grid.innerHTML = `<div class="estado-msg erro">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
        </svg>
        <p>Erro ao carregar produtos</p>
        <button class="btn-retry" onclick="location.reload()">Tentar novamente</button>
      </div>`;
    }
  }

  function renderizar(grid, produtos) {
    grid.innerHTML = produtos.map((p, i) => cardHtml(p, i)).join('');
    // Staggered entrance animation
    grid.querySelectorAll('.card').forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'opacity .4s ease, transform .4s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, i * 80);
    });
    grid.querySelectorAll('.btn-zap').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const p = produtos.find(x => x.id === btn.dataset.id);
        if (p) abrirModal(p);
      });
    });
  }

  // SVG placeholders por categoria
  const SVGS = {
    'Compressores': '<svg viewBox="0 0 64 64" fill="none" stroke-width="1.5" stroke-linecap="round"><circle cx="32" cy="32" r="18" stroke="rgba(26,58,34,.25)"/><circle cx="32" cy="32" r="8" stroke="rgba(26,58,34,.35)"/><path d="M32 14v6M32 44v6M14 32h6M44 32h6M20.2 20.2l4.2 4.2M39.6 39.6l4.2 4.2M20.2 43.8l4.2-4.2M39.6 24.4l4.2-4.2" stroke="rgba(26,58,34,.2)"/></svg>',
    'Condensadores': '<svg viewBox="0 0 64 64" fill="none" stroke-width="1.5" stroke-linecap="round"><rect x="12" y="18" width="40" height="28" rx="3" stroke="rgba(26,58,34,.25)"/><path d="M20 18v28M28 18v28M36 18v28M44 18v28" stroke="rgba(26,58,34,.15)"/><path d="M12 32h40" stroke="rgba(26,58,34,.2)"/></svg>',
    'Evaporadores': '<svg viewBox="0 0 64 64" fill="none" stroke-width="1.5" stroke-linecap="round"><path d="M10 38c6-8 12 8 18 0s12 8 18 0s12 8 18 0" stroke="rgba(26,58,34,.2)"/><path d="M10 28c6-8 12 8 18 0s12 8 18 0s12 8 18 0" stroke="rgba(26,58,34,.25)"/><path d="M10 48c6-8 12 8 18 0s12 8 18 0s12 8 18 0" stroke="rgba(26,58,34,.15)"/></svg>',
    'Válvulas': '<svg viewBox="0 0 64 64" fill="none" stroke-width="1.5" stroke-linecap="round"><circle cx="32" cy="32" r="12" stroke="rgba(26,58,34,.25)"/><path d="M32 8v12M32 44v12M20 32L8 32M44 32l12 0" stroke="rgba(26,58,34,.2)"/><circle cx="32" cy="32" r="5" stroke="rgba(26,58,34,.35)"/></svg>',
  };
  const SVG_DEFAULT = '<svg viewBox="0 0 64 64" fill="none" stroke-width="1.5"><rect x="16" y="16" width="32" height="32" rx="4" stroke="rgba(26,58,34,.2)"/><path d="M28 24h8M24 32h16M28 40h8" stroke="rgba(26,58,34,.15)" stroke-linecap="round"/></svg>';

  function cardHtml(p, i) {
    const img = p.foto_url
      ? `<img src="${esc(p.foto_url)}" alt="${esc(p.nome)}" loading="lazy">`
      : (SVGS[p.categoria] || SVG_DEFAULT);
    const statusBadge = p.status === 'sob_encomenda' ? '<span class="card-badge encom">Sob encomenda</span>' : '';

    return `<div class="card">
      <div class="card-img">${img}${statusBadge}</div>
      <div class="card-body">
        <div class="tags">${tagsHtml(p)}</div>
        <h3>${esc(p.nome)}</h3>
        <div class="desc">${esc(p.descricao || '')}</div>
        ${p.codigo ? `<div class="code">Cód: ${esc(p.codigo)}</div>` : ''}
        <div class="price">${fmtPreco(p.preco)}</div>
        <button class="btn-zap" data-id="${p.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:6px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
          Consultar via WhatsApp
        </button>
      </div>
    </div>`;
  }

  function tagsHtml(p) {
    let t = '';
    if (p.linha) {
      const cls = { 'agrícola': 'agri', 'automotiva': 'auto', 'pesada': 'pesada' }[p.linha.toLowerCase()] || 'agri';
      t += `<span class="tag ${cls}">${esc(p.linha)}</span>`;
    }
    if (p.destaque) t += `<span class="tag hot">Destaque</span>`;
    return t;
  }

  function gerarSkeletons(n) {
    return Array(n).fill(`<div class="card skeleton-card">
      <div class="skeleton-img"></div>
      <div class="card-body">
        <div class="skeleton-line w60"></div>
        <div class="skeleton-line w90"></div>
        <div class="skeleton-line w40"></div>
        <div class="skeleton-line w30"></div>
      </div>
    </div>`).join('');
  }

  function filtrarPreco(arr, faixa) {
    if (faixa === 'ate500') return arr.filter(p => p.preco <= 500);
    if (faixa === '500-2000') return arr.filter(p => p.preco > 500 && p.preco <= 2000);
    if (faixa === 'acima2000') return arr.filter(p => p.preco > 2000);
    return arr;
  }

  // ── FILTROS ─────────────────────────────────────────

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function coletarFiltros() {
    return {
      busca: val('busca-input'),
      linha: val('filtro-linha'),
      marca: val('filtro-marca'),
      tipo_maquina: val('filtro-tipo-maquina'),
      preco: val('filtro-preco'),
      status: val('filtro-disponibilidade'),
    };
  }

  function bindFiltros() {
    const btn = document.getElementById('btn-buscar');
    const input = document.getElementById('busca-input');

    if (btn) btn.addEventListener('click', () => carregarProdutos(coletarFiltros()));
    if (input) input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); carregarProdutos(coletarFiltros()); }
    });

    ['filtro-linha', 'filtro-marca', 'filtro-tipo-maquina', 'filtro-preco', 'filtro-disponibilidade'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => carregarProdutos(coletarFiltros()));
    });
  }

  function bindCategorias() {
    document.querySelectorAll('.cat[data-categoria]').forEach(cat => {
      cat.addEventListener('click', e => {
        e.preventDefault();
        carregarProdutos({ categoria: cat.dataset.categoria });
        document.getElementById('grid-produtos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ── MODAL DE LEAD ───────────────────────────────────

  let modalEl = null;
  let produtoAtual = null;

  function injetarModal() {
    const div = document.createElement('div');
    div.id = 'modal-lead';
    div.className = 'modal-overlay';
    div.style.display = 'none';
    div.innerHTML = `
      <div class="modal-box">
        <button class="modal-fechar" id="modal-fechar">&times;</button>
        <h2 class="modal-titulo">Consultar via WhatsApp</h2>
        <p class="modal-produto" id="modal-produto-nome"></p>
        <form id="form-lead">
          <div class="campo">
            <label for="lead-nome">Nome <span class="opcional">(opcional)</span></label>
            <input type="text" id="lead-nome" placeholder="Seu nome">
          </div>
          <div class="campo">
            <label for="lead-telefone">Telefone <span class="obrigatorio">*</span></label>
            <input type="tel" id="lead-telefone" placeholder="(64) 99999-9999" required>
          </div>
          <div class="campo">
            <label for="lead-email">E-mail <span class="opcional">(opcional)</span></label>
            <input type="email" id="lead-email" placeholder="voce@email.com">
          </div>
          <div class="campo">
            <label for="lead-cidade">Cidade <span class="opcional">(opcional)</span></label>
            <input type="text" id="lead-cidade" placeholder="Sua cidade">
          </div>
          <div id="lead-erro" class="lead-erro"></div>
          <button type="submit" class="btn-enviar" id="btn-enviar">
            <span class="btn-texto">Enviar e abrir WhatsApp</span>
            <span class="btn-loading" style="display:none">Enviando...</span>
          </button>
        </form>
      </div>`;
    document.body.appendChild(div);
    modalEl = div;

    document.getElementById('modal-fechar').addEventListener('click', fecharModal);
    modalEl.addEventListener('click', e => { if (e.target === modalEl) fecharModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalEl.style.display !== 'none') fecharModal(); });
    document.getElementById('form-lead').addEventListener('submit', enviarLead);
  }

  function abrirModal(produto) {
    produtoAtual = produto;
    document.getElementById('modal-produto-nome').textContent = produto.nome;
    document.getElementById('lead-erro').textContent = '';
    document.getElementById('form-lead').reset();
    modalEl.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('lead-telefone').focus(), 100);
  }

  function fecharModal() {
    modalEl.style.display = 'none';
    document.body.style.overflow = '';
    produtoAtual = null;
  }

  async function enviarLead(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-enviar');
    const erroEl = document.getElementById('lead-erro');
    const telefone = document.getElementById('lead-telefone').value.trim();
    const nome = document.getElementById('lead-nome').value.trim();
    const email = document.getElementById('lead-email').value.trim();
    const cidade = document.getElementById('lead-cidade').value.trim();

    if (!telefone) { erroEl.textContent = 'Telefone é obrigatório'; return; }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { erroEl.textContent = 'E-mail inválido'; return; }

    erroEl.textContent = '';
    setBtnLoading(btn, true);

    try {
      const r = await fetch(`${API}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome || null,
          telefone,
          email: email || null,
          cidade: cidade || null,
          produto_id: produtoAtual?.id || null,
        }),
      });

      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.erro || 'Erro ao enviar');
      }

      if (!appConfig.whatsapp) {
        throw new Error('WhatsApp da loja não configurado');
      }

      const msg = montarMensagemWhatsApp(produtoAtual);
      window.open(`https://wa.me/${appConfig.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
      fecharModal();
    } catch (err) {
      erroEl.textContent = err.message || 'Erro ao enviar. Tente novamente.';
    } finally {
      setBtnLoading(btn, false);
    }
  }

  // ── UTILS ───────────────────────────────────────────

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

  function montarMensagemWhatsApp(produto) {
    const template = appConfig.mensagem_whatsapp || 'Olá! Tenho interesse no {produto}{codigo} que vi no catálogo.';
    return template
      .replace('{produto}', produto?.nome || 'produto')
      .replace('{codigo}', produto?.codigo ? ` (Cód: ${produto.codigo})` : '');
  }

  function aplicarConfigVisual() {
    if (appConfig.cor_principal) {
      document.documentElement.style.setProperty('--brand-dark', appConfig.cor_principal);
    }
  }

  function fmtPreco(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }

  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

})();
