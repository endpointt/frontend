(function () {
  'use strict';

  const API = getApiBase();
  const CONFIG_KEYS = ['nome_empresa', 'whatsapp', 'cidade', 'logo_url', 'cor_principal', 'mensagem_whatsapp'];

  let token = localStorage.getItem('agroair_token');
  let editandoId = null;
  let configAtual = {};

  document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
      window.location.href = 'Login.html';
      return;
    }
    init();
  });

  async function init() {
    atualizarEmailAdmin();

    document.getElementById('btn-logout').addEventListener('click', logout);
    document.getElementById('btn-novo').addEventListener('click', abrirFormNovo);
    document.getElementById('btn-cancelar').addEventListener('click', fecharForm);
    document.getElementById('form-produto').addEventListener('submit', salvarProduto);
    document.getElementById('form-config').addEventListener('submit', salvarConfig);
    document.getElementById('tab-produtos').addEventListener('click', () => trocarTab('produtos'));
    document.getElementById('tab-leads').addEventListener('click', () => trocarTab('leads'));
    document.getElementById('tab-config').addEventListener('click', () => trocarTab('config'));

    await Promise.all([
      carregarProdutos(),
      carregarConfigPainel(true),
    ]);

    carregarStats();
  }

  async function carregarStats() {
    try {
      const [rProd, rLeads] = await Promise.all([
        fetch(`${API}/produtos`),
        fetch(`${API}/leads`, { headers: headers() }),
      ]);
      const produtos = rProd.ok ? await rProd.json() : [];
      const leads = rLeads.ok ? await rLeads.json() : [];
      const emEstoque = produtos.filter(p => p.status === 'em_estoque').length;

      document.getElementById('stat-produtos').textContent = produtos.length;
      document.getElementById('stat-leads').textContent = leads.length;
      document.getElementById('stat-estoque').textContent = emEstoque;
    } catch {
      // silently fail
    }
  }

  function headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // ── TABS ──
  function trocarTab(tab) {
    document.getElementById('tab-produtos').classList.toggle('ativo', tab === 'produtos');
    document.getElementById('tab-leads').classList.toggle('ativo', tab === 'leads');
    document.getElementById('tab-config').classList.toggle('ativo', tab === 'config');

    document.getElementById('secao-produtos').style.display = tab === 'produtos' ? 'block' : 'none';
    document.getElementById('secao-leads').style.display = tab === 'leads' ? 'block' : 'none';
    document.getElementById('secao-config').style.display = tab === 'config' ? 'block' : 'none';

    if (tab === 'leads') carregarLeads();
    if (tab === 'config') carregarConfigPainel();
  }

  // ── PRODUTOS ──
  async function carregarProdutos() {
    const tbody = document.getElementById('tbody-produtos');
    tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Carregando...</td></tr>';

    try {
      const r = await fetch(`${API}/produtos`);
      if (!r.ok) throw new Error();
      const data = await r.json();

      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="vazio-row">Nenhum produto cadastrado</td></tr>';
        document.getElementById('cont-produtos').textContent = '';
        return;
      }

      tbody.innerHTML = data.map(p => `
        <tr>
          <td><strong>${esc(p.nome)}</strong><br><span class="cod">${esc(p.codigo || '—')}</span></td>
          <td>${esc(p.categoria || '—')}</td>
          <td>${esc(p.linha || '—')}</td>
          <td class="preco-col">${fmtPreco(p.preco)}</td>
          <td><span class="badge ${p.status === 'em_estoque' ? 'badge-ok' : 'badge-enc'}">${p.status === 'em_estoque' ? 'Estoque' : 'Encomenda'}</span></td>
          <td class="acoes">
            <button class="btn-editar" data-id="${p.id}">Editar</button>
            <button class="btn-excluir" data-id="${p.id}">Excluir</button>
          </td>
        </tr>`).join('');

      tbody.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', () => editarProduto(data.find(p => p.id === btn.dataset.id)));
      });
      tbody.querySelectorAll('.btn-excluir').forEach(btn => {
        btn.addEventListener('click', () => excluirProduto(btn.dataset.id));
      });

      document.getElementById('cont-produtos').textContent = `${data.length} produto${data.length > 1 ? 's' : ''}`;
    } catch {
      tbody.innerHTML = '<tr><td colspan="6" class="erro-row">Erro ao carregar produtos</td></tr>';
    }
  }

  function abrirFormNovo() {
    editandoId = null;
    document.getElementById('form-titulo').textContent = 'Novo Produto';
    document.getElementById('form-produto').reset();
    document.getElementById('painel-form').style.display = 'block';
    document.getElementById('form-erro').textContent = '';
    document.getElementById('f-nome').focus();
  }

  function editarProduto(p) {
    editandoId = p.id;
    document.getElementById('form-titulo').textContent = 'Editar Produto';
    document.getElementById('f-nome').value = p.nome || '';
    document.getElementById('f-descricao').value = p.descricao || '';
    document.getElementById('f-codigo').value = p.codigo || '';
    document.getElementById('f-preco').value = p.preco || '';
    document.getElementById('f-categoria').value = p.categoria || '';
    document.getElementById('f-linha').value = p.linha || '';
    document.getElementById('f-marca').value = p.marca || '';
    document.getElementById('f-tipo-maquina').value = p.tipo_maquina || '';
    document.getElementById('f-compatibilidade').value = p.compatibilidade || '';
    document.getElementById('f-status').value = p.status || 'em_estoque';
    document.getElementById('f-destaque').checked = p.destaque || false;
    document.getElementById('f-foto-url').value = p.foto_url || '';
    document.getElementById('painel-form').style.display = 'block';
    document.getElementById('form-erro').textContent = '';
    document.getElementById('f-nome').focus();
  }

  function fecharForm() {
    document.getElementById('painel-form').style.display = 'none';
    editandoId = null;
  }

  async function salvarProduto(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar');
    const erroEl = document.getElementById('form-erro');

    const body = {
      nome: document.getElementById('f-nome').value.trim(),
      descricao: document.getElementById('f-descricao').value.trim() || null,
      codigo: document.getElementById('f-codigo').value.trim() || null,
      preco: parseFloat(document.getElementById('f-preco').value),
      categoria: document.getElementById('f-categoria').value || null,
      linha: document.getElementById('f-linha').value || null,
      marca: document.getElementById('f-marca').value.trim() || null,
      tipo_maquina: document.getElementById('f-tipo-maquina').value.trim() || null,
      compatibilidade: document.getElementById('f-compatibilidade').value.trim() || null,
      status: document.getElementById('f-status').value,
      destaque: document.getElementById('f-destaque').checked,
      foto_url: document.getElementById('f-foto-url').value.trim() || null,
    };

    if (!body.nome || Number.isNaN(body.preco)) {
      erroEl.textContent = 'Nome e preço são obrigatórios';
      return;
    }

    erroEl.textContent = '';
    setButtonLoading(btn, true, 'Salvando...', 'Salvar Produto');

    try {
      const url = editandoId ? `${API}/produtos/${editandoId}` : `${API}/produtos`;
      const method = editandoId ? 'PUT' : 'POST';

      const r = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Erro ao salvar');

      fecharForm();
      await carregarProdutos();
      carregarStats();
    } catch (err) {
      erroEl.textContent = err.message;
    } finally {
      setButtonLoading(btn, false, 'Salvando...', 'Salvar Produto');
    }
  }

  async function excluirProduto(id) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      const r = await fetch(`${API}/produtos/${id}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error();
      await carregarProdutos();
      carregarStats();
    } catch {
      alert('Erro ao excluir produto');
    }
  }

  // ── LEADS ──
  async function carregarLeads() {
    const tbody = document.getElementById('tbody-leads');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Carregando...</td></tr>';

    try {
      const r = await fetch(`${API}/leads`, { headers: headers() });
      if (!r.ok) throw new Error();
      const data = await r.json();

      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="vazio-row">Nenhum lead captado ainda</td></tr>';
        document.getElementById('cont-leads').textContent = '';
        return;
      }

      tbody.innerHTML = data.map(l => `
        <tr>
          <td>${esc(l.nome || '—')}</td>
          <td>${esc(l.telefone)}</td>
          <td>${esc(l.cidade || '—')}</td>
          <td>${l.produtos ? esc(l.produtos.nome) : '—'}</td>
          <td>${new Date(l.criado_em).toLocaleDateString('pt-BR')}</td>
        </tr>`).join('');

      document.getElementById('cont-leads').textContent = `${data.length} lead${data.length > 1 ? 's' : ''}`;
    } catch {
      tbody.innerHTML = '<tr><td colspan="5" class="erro-row">Erro ao carregar leads</td></tr>';
    }
  }

  // ── CONFIG ──
  async function carregarConfigPainel(silencioso = false) {
    const erroEl = document.getElementById('config-erro');
    const sucessoEl = document.getElementById('config-sucesso');

    if (!silencioso) {
      erroEl.textContent = '';
      sucessoEl.textContent = '';
    }

    try {
      const r = await fetch(`${API}/config`);
      if (!r.ok) throw new Error('Erro ao carregar configurações');
      const data = await r.json();
      configAtual = data || {};

      setFieldValue('cfg-nome-empresa', data.nome_empresa);
      setFieldValue('cfg-whatsapp', data.whatsapp);
      setFieldValue('cfg-cidade', data.cidade);
      setFieldValue('cfg-logo-url', data.logo_url);
      setFieldValue('cfg-cor-principal', data.cor_principal);
      setFieldValue('cfg-mensagem-whatsapp', data.mensagem_whatsapp);
    } catch (err) {
      if (!silencioso) erroEl.textContent = err.message || 'Erro ao carregar configurações';
    }
  }

  async function salvarConfig(e) {
    e.preventDefault();

    const btn = document.getElementById('btn-salvar-config');
    const erroEl = document.getElementById('config-erro');
    const sucessoEl = document.getElementById('config-sucesso');

    const payload = {
      nome_empresa: document.getElementById('cfg-nome-empresa').value.trim(),
      whatsapp: document.getElementById('cfg-whatsapp').value.trim(),
      cidade: document.getElementById('cfg-cidade').value.trim(),
      logo_url: document.getElementById('cfg-logo-url').value.trim(),
      cor_principal: document.getElementById('cfg-cor-principal').value.trim(),
      mensagem_whatsapp: document.getElementById('cfg-mensagem-whatsapp').value.trim(),
    };

    if (!payload.nome_empresa || !payload.whatsapp || !payload.cidade) {
      erroEl.textContent = 'Nome da empresa, WhatsApp e cidade são obrigatórios';
      sucessoEl.textContent = '';
      return;
    }

    erroEl.textContent = '';
    sucessoEl.textContent = '';
    setButtonLoading(btn, true, 'Salvando...', 'Salvar Configurações');

    try {
      const alteradas = CONFIG_KEYS
        .filter(chave => payload[chave] && payload[chave] !== (configAtual[chave] || ''));

      if (!alteradas.length) {
        sucessoEl.textContent = 'Nada para salvar, já está tudo em dia';
        return;
      }

      for (const chave of alteradas) {
        const r = await fetch(`${API}/config/${chave}`, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify({ valor: payload[chave] }),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(data.erro || `Erro ao salvar ${chave}`);
        }
      }

      configAtual = { ...configAtual, ...payload };
      sucessoEl.textContent = 'Configurações salvas com sucesso';
    } catch (err) {
      erroEl.textContent = err.message || 'Erro ao salvar configurações';
    } finally {
      setButtonLoading(btn, false, 'Salvando...', 'Salvar Configurações');
    }
  }

  // ── AUTH ──
  function logout() {
    localStorage.removeItem('agroair_token');
    localStorage.removeItem('agroair_admin_email');
    window.location.href = 'Login.html';
  }

  // ── UTILS ──
  function setButtonLoading(btn, loading, loadingText, defaultText) {
    btn.disabled = loading;
    btn.textContent = loading ? loadingText : defaultText;
  }

  function atualizarEmailAdmin() {
    const el = document.querySelector('.hdr-user');
    const email = localStorage.getItem('agroair_admin_email');
    if (el && email) el.textContent = email;
  }

  function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  function getApiBase() {
    const explicit = window.AGROAIR_API_BASE || localStorage.getItem('agroair_api_base');
    const base = explicit
      ? explicit.replace(/\/+$/, '').replace(/\/api$/, '')
      : (window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin);
    return `${base}/api`;
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
