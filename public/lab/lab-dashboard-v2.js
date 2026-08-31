(() => {
  'use strict';

  const API = '/lab/api';
  const SESSION_KEY = 'desorden_lab_office_session_v1';
  let selectedOperatorId = '';
  let refreshTimer = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    })[char]);
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0]?.slice(0, 2) || 'OP').toUpperCase();
  }

  async function api(path) {
    const token = sessionStorage.getItem(SESSION_KEY) || '';
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API}${path}`, { headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  function ensurePanel() {
    let panel = $('#operator-inline-panel');
    if (panel) return panel;
    const home = $('[data-panel="home"]');
    if (!home) return null;
    panel = document.createElement('section');
    panel.id = 'operator-inline-panel';
    panel.className = 'operator-inline-panel';
    panel.hidden = true;
    home.prepend(panel);
    return panel;
  }

  function markSelectedOperator(operatorId) {
    $$('.operator-chip[data-operator-id]').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.operatorId === operatorId);
    });
    $$('[data-open-drawer]').forEach((card) => {
      card.classList.toggle('active', card.dataset.openDrawer === operatorId);
    });
  }

  function hideOperatorPanel() {
    selectedOperatorId = '';
    clearInterval(refreshTimer);
    refreshTimer = null;
    const panel = ensurePanel();
    if (panel) panel.hidden = true;
    markSelectedOperator('all');
  }

  function stateInfo(operator, summary) {
    if (operator?.status === 'disabled') {
      return { label: 'DESACTIVADO', cls: 'state-disabled' };
    }
    if (summary?.state === 'TRABAJANDO') {
      return { label: 'TRABAJANDO', cls: 'state-working' };
    }
    if (summary?.state === 'PAUSA') {
      return { label: 'EN PAUSA', cls: 'state-paused' };
    }
    return { label: 'JORNADA FINALIZADA', cls: 'state-finished' };
  }

  function normalizeJobs(payload) {
    const list = Array.isArray(payload) ? payload : payload?.rows || payload?.jobs || payload?.items || payload?.agenda || [];
    return list.map((raw) => ({
      id: raw.id || raw.jobId || raw.eventId || raw.sa || '',
      sa: raw.sa || raw.SA || raw.workOrder || '',
      client: raw.client || raw.cliente || raw.customer || '',
      city: raw.city || raw.poblacion || '',
      type: raw.type || raw.tipo || raw.serviceType || 'Trabajo',
      date: raw.date || raw.fecha || '',
      time: raw.time || raw.hora || '',
    }));
  }

  function normalizePhotos(payload) {
    return Array.isArray(payload) ? payload : payload?.photos || payload?.items || [];
  }

  function renderJobsBlock(title, jobs) {
    const rows = jobs.slice(0, 6).map((job) => `
      <div class="operator-inline-row">
        <time>${esc(job.time || '—')}</time>
        <div>
          <strong>${esc(job.sa || job.client || 'TRABAJO')}</strong>
          <small>${esc(job.client || '—')}${job.city ? ` · ${esc(job.city)}` : ''}</small>
        </div>
        <span class="operator-inline-type">${esc(job.type || 'Trabajo')}</span>
      </div>
    `).join('');

    return `
      <div class="operator-inline-block">
        <h3>${esc(title)}</h3>
        <div class="operator-inline-list">
          ${rows || '<div class="operator-inline-empty">Sin trabajos en este periodo.</div>'}
        </div>
      </div>
    `;
  }

  async function showOperatorPanel(operatorId, { silent = false } = {}) {
    const panel = ensurePanel();
    if (!panel || !operatorId || operatorId === 'all') return;

    selectedOperatorId = operatorId;
    markSelectedOperator(operatorId);

    if (!silent) {
      panel.hidden = false;
      panel.innerHTML = '<div class="operator-inline-loading">● &nbsp; ● &nbsp; ● &nbsp;&nbsp; CARGANDO OPERARIO</div>';
    }

    try {
      const [operatorsPayload, clockPayload, agendaPayload, photosPayload] = await Promise.all([
        api('/operators'),
        api(`/clock?operatorId=${encodeURIComponent(operatorId)}&period=today`),
        api(`/agenda?operatorId=${encodeURIComponent(operatorId)}`),
        api(`/photos?operatorId=${encodeURIComponent(operatorId)}`),
      ]);

      if (selectedOperatorId !== operatorId) return;

      const operators = Array.isArray(operatorsPayload)
        ? operatorsPayload
        : operatorsPayload?.operators || operatorsPayload?.items || [];
      const op = operators.find((item) => (item.operatorId || item.OPERATOR_ID || item.id) === operatorId);
      if (!op) throw new Error('Operario no encontrado');

      const name = op.name || op.NOMBRE || op.username || op.USERNAME || 'Operario';
      const username = op.username || op.USERNAME || '';
      const phone = op.phone || op.telefono || op['TELÉFONO'] || '';
      const photoUrl = op.photoUrl || op.PHOTO_URL || '';
      const canCreateJobs = Boolean(op.canCreateJobs ?? op.CAN_CREATE_JOBS ?? false);
      const panasonicAccess = Boolean(op.panasonicAccess ?? op.PANASONIC_ACCESS ?? false);
      const status = op.status || op.estado || op.ESTADO || 'active';
      const operator = { ...op, status };

      const summary = clockPayload?.summary || {};
      const visual = stateInfo(operator, summary);
      const jobs = normalizeJobs(agendaPayload);
      const photos = normalizePhotos(photosPayload);
      const today = new Date().toISOString().slice(0, 10);
      const todayJobs = jobs
        .filter((job) => job.date === today)
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      const upcomingJobs = jobs
        .filter((job) => job.date > today)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

      const avatar = photoUrl
        ? `<img src="${esc(photoUrl)}" alt="${esc(name)}" />`
        : esc(initials(name));

      const photoHtml = photos.slice(0, 4).map((photo) => {
        const src = photo.url || photo.photoUrl || '';
        return src
          ? `<div class="operator-inline-photo"><img src="${esc(src)}" alt="Foto de ${esc(name)}" loading="lazy" /></div>`
          : '';
      }).join('');

      panel.innerHTML = `
        <div class="operator-inline-head">
          <div class="operator-inline-avatar ${esc(visual.cls)}">${avatar}</div>
          <div class="operator-inline-identity">
            <span class="eyebrow">OPERARIO SELECCIONADO</span>
            <h2>${esc(name)}</h2>
            <div class="operator-inline-meta">
              ${username ? `<span>@${esc(username)}</span>` : ''}
              ${phone ? `<span>${esc(phone)}</span>` : ''}
            </div>
          </div>
          <button type="button" class="ghost operator-inline-close" data-inline-close>VER TODOS</button>
        </div>

        <div class="operator-inline-metrics">
          <div class="operator-inline-metric">
            <span>ESTADO LABORAL</span>
            <strong class="${esc(visual.cls)}">${esc(visual.label)}</strong>
          </div>
          <div class="operator-inline-metric">
            <span>ENTRADA HOY</span>
            <strong>${esc(summary.firstEntry || summary.in || '—')}</strong>
          </div>
          <div class="operator-inline-metric">
            <span>SALIDA HOY</span>
            <strong>${esc(summary.lastExit || summary.out || '—')}</strong>
          </div>
          <div class="operator-inline-metric">
            <span>TOTAL HOY</span>
            <strong>${esc(summary.worked || summary.total || '0h 0m')}</strong>
          </div>
        </div>

        <div class="operator-inline-grid">
          ${renderJobsBlock('Trabajos de hoy', todayJobs)}
          ${renderJobsBlock('Próximos trabajos', upcomingJobs)}
          <div class="operator-inline-block">
            <h3>Datos y permisos</h3>
            <div class="operator-inline-permissions">
              <span class="badge ${canCreateJobs ? 'ok' : 'muted'}">${canCreateJobs ? 'CREA TRABAJOS' : 'SOLO LECTURA'}</span>
              <span class="badge ${panasonicAccess ? 'ok' : 'muted'}">${panasonicAccess ? 'PANASONIC' : 'GENERAL'}</span>
            </div>
            <div class="operator-inline-empty">${phone ? `Teléfono: ${esc(phone)}` : 'Sin teléfono registrado.'}</div>
          </div>
          <div class="operator-inline-block">
            <h3>Fotos recientes</h3>
            <div class="operator-inline-photos">
              ${photoHtml || '<div class="operator-inline-empty">Sin fotos recientes.</div>'}
            </div>
          </div>
        </div>
      `;

      panel.hidden = false;
      panel.querySelector('[data-inline-close]')?.addEventListener('click', hideOperatorPanel);
    } catch (error) {
      if (selectedOperatorId !== operatorId) return;
      panel.hidden = false;
      panel.innerHTML = `
        <div class="operator-inline-loading operator-inline-error">
          No se ha podido cargar el operario · ${esc(error.message)}
        </div>
      `;
    }
  }

  function openInlineOperator(operatorId) {
    if (!operatorId || operatorId === 'all') {
      hideOperatorPanel();
      return;
    }

    const homeNav = $('.nav-item[data-view="home"]');
    const homePanel = $('[data-panel="home"]');
    if (homePanel?.hidden && homeNav) homeNav.click();

    void showOperatorPanel(operatorId);
    clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => {
      if (selectedOperatorId) void showOperatorPanel(selectedOperatorId, { silent: true });
    }, 30000);
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const chip = target.closest('.operator-chip[data-operator-id]');
    const homeCard = target.closest('[data-open-drawer]');
    const trigger = chip || homeCard;
    if (!trigger) return;

    const operatorId = chip ? chip.dataset.operatorId : homeCard.dataset.openDrawer;
    if (operatorId === 'all') {
      hideOperatorPanel();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    openInlineOperator(operatorId);
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const nav = target?.closest('.nav-item[data-view]');
    if (nav && nav.dataset.view !== 'home') {
      const panel = ensurePanel();
      if (panel) panel.hidden = true;
    } else if (nav?.dataset.view === 'home' && selectedOperatorId) {
      const panel = ensurePanel();
      if (panel) panel.hidden = false;
    }
  });

  const tabs = $('#operator-tabs');
  if (tabs) {
    const observer = new MutationObserver(() => {
      if (selectedOperatorId) markSelectedOperator(selectedOperatorId);
    });
    observer.observe(tabs, { childList: true, subtree: true });
  }

  // Keep the selected operator stable while the "Nuevo trabajo" dialog is open.
  // lab.js refreshes operators every 4s and rebuilds #job-operator with innerHTML,
  // which otherwise resets the current selection to the placeholder option.
  const jobDialog = $('#job-dialog');
  const jobOperatorSelect = $('#job-operator');
  let rememberedJobOperatorId = '';

  if (jobOperatorSelect) {
    jobOperatorSelect.addEventListener('change', () => {
      rememberedJobOperatorId = jobOperatorSelect.value || '';
    });

    const optionObserver = new MutationObserver(() => {
      if (!rememberedJobOperatorId) return;
      const stillAvailable = [...jobOperatorSelect.options].some(
        (option) => option.value === rememberedJobOperatorId
      );
      if (stillAvailable && jobOperatorSelect.value !== rememberedJobOperatorId) {
        jobOperatorSelect.value = rememberedJobOperatorId;
      }
    });
    optionObserver.observe(jobOperatorSelect, { childList: true });
  }

  if (jobDialog && jobOperatorSelect) {
    const dialogObserver = new MutationObserver(() => {
      if (jobDialog.hasAttribute('open')) {
        rememberedJobOperatorId = jobOperatorSelect.value || '';
      } else {
        rememberedJobOperatorId = '';
      }
    });
    dialogObserver.observe(jobDialog, { attributes: true, attributeFilter: ['open'] });
  }

  ensurePanel();
})();
