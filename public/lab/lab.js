(() => {
  'use strict';

  const API = '/lab/api';
  const SESSION_KEY = 'desorden_lab_office_session_v1';

  const state = {
    weekStart: startOfWeek(new Date()),
    selectedOperator: 'all',
    drawerOperator: null,
    operators: [],
    operatorsSummary: {},
    presence: {},
    agenda: [],
    clock: [],
    photos: [],
    chatMessages: [],
    activeView: 'home',
    period: 'today',
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  // ==================================================
  // GLOBAL FEEDBACK SYSTEM
  // ==================================================
  let feedbackTimer = null;

  function showLoading(title = 'CARGANDO…', detail = '') {
    clearTimeout(feedbackTimer);
    const box = $('#global-feedback');
    const dots = $('#feedback-dots');
    const icon = $('#feedback-icon');
    const titleEl = $('#feedback-title');
    const detailEl = $('#feedback-detail');
    const retryBtn = $('#feedback-retry-btn');
    if (!box) return;

    box.className = 'global-feedback state-loading';
    if (dots) dots.hidden = false;
    if (icon) icon.hidden = true;
    if (titleEl) titleEl.textContent = title;
    if (detailEl) {
      detailEl.textContent = detail;
      detailEl.hidden = !detail;
    }
    if (retryBtn) retryBtn.hidden = true;
    box.hidden = false;
  }

  function showSuccess(title = 'DATOS ACTUALIZADOS', duration = 2000) {
    clearTimeout(feedbackTimer);
    const box = $('#global-feedback');
    const dots = $('#feedback-dots');
    const icon = $('#feedback-icon');
    const titleEl = $('#feedback-title');
    const detailEl = $('#feedback-detail');
    const retryBtn = $('#feedback-retry-btn');
    if (!box) return;

    box.className = 'global-feedback state-success';
    if (dots) dots.hidden = true;
    if (icon) {
      icon.textContent = '✓';
      icon.hidden = false;
    }
    if (titleEl) titleEl.textContent = title;
    if (detailEl) detailEl.hidden = true;
    if (retryBtn) retryBtn.hidden = true;
    box.hidden = false;

    if (duration > 0) {
      feedbackTimer = setTimeout(() => {
        hideFeedback();
      }, duration);
    }
  }

  function showError(title = 'ERROR', detail = '', retryFn = null) {
    clearTimeout(feedbackTimer);
    const box = $('#global-feedback');
    const dots = $('#feedback-dots');
    const icon = $('#feedback-icon');
    const titleEl = $('#feedback-title');
    const detailEl = $('#feedback-detail');
    const retryBtn = $('#feedback-retry-btn');
    if (!box) return;

    box.className = 'global-feedback state-error';
    if (dots) dots.hidden = true;
    if (icon) {
      icon.textContent = '✕';
      icon.hidden = false;
    }
    if (titleEl) titleEl.textContent = title;
    if (detailEl) {
      detailEl.textContent = detail;
      detailEl.hidden = !detail;
    }
    if (retryBtn) {
      if (typeof retryFn === 'function') {
        retryBtn.hidden = false;
        retryBtn.onclick = () => {
          hideFeedback();
          retryFn();
        };
      } else {
        retryBtn.hidden = true;
      }
    }
    box.hidden = false;

    feedbackTimer = setTimeout(() => {
      hideFeedback();
    }, 6000);
  }

  function hideFeedback() {
    clearTimeout(feedbackTimer);
    const box = $('#global-feedback');
    if (box) box.hidden = true;
  }

  // ==================================================
  // DATE & STRING UTILITIES
  // ==================================================
  function startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay() || 7;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day + 1);
    return d;
  }

  function addDays(date, amount) {
    const d = new Date(date);
    d.setDate(d.getDate() + amount);
    return d;
  }

  function isoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function fmtDate(date, options = {}) {
    return new Intl.DateTimeFormat('es-ES', options).format(date);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }

  function getOperatorInitials(name) {
    const parts = String(name || '').trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name.slice(0, 2) || 'OP').toUpperCase();
  }

  function formatPresenceRelative(lastSeenAt, isConnected) {
    if (!lastSeenAt) return 'DESCONECTADO';
    const ms = Date.now() - new Date(lastSeenAt).getTime();
    if (isNaN(ms) || ms < 0) return isConnected ? 'CONECTADO · ahora' : 'DESCONECTADO';
    if (ms < 90000) return 'CONECTADO · ahora';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `DESCONECTADO · hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `DESCONECTADO · hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `DESCONECTADO · hace ${days} d`;
  }

  // ==================================================
  // API CLIENT
  // ==================================================
  async function api(path, options = {}) {
    const token = sessionStorage.getItem(SESSION_KEY) || '';
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, { ...options, headers });
    if (res.status === 401) {
      sessionStorage.removeItem(SESSION_KEY);
      location.reload();
      throw new Error('Sesión expirada');
    }
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function setConnection(isOnline, label = '') {
    const el = $('#connection-state');
    if (!el) return;
    if (isOnline) {
      el.className = 'connection ok';
      el.textContent = '● CONECTADO';
    } else {
      el.className = 'connection error';
      el.textContent = `● ${label || 'SIN CONEXIÓN'}`;
    }
  }

  function enterApp() {
    const login = $('#login-screen');
    const shell = $('#app-shell');
    if (login) login.hidden = true;
    if (shell) shell.hidden = false;
    updateNow();
    void refreshAll();
  }

  // ==================================================
  // AUTHENTICATION
  // ==================================================
  async function handleLogin(event) {
    event.preventDefault();
    const userInp = $('#login-user');
    const passInp = $('#login-pass');
    const username = userInp?.value.trim() || '';
    const password = passInp?.value || '';
    const msg = $('#login-message');
    const submitBtn = $('#login-submit-btn');

    if (userInp) userInp.classList.remove('input-error');
    if (passInp) passInp.classList.remove('input-error');
    if (msg) msg.textContent = '';
    if (submitBtn) submitBtn.disabled = true;

    showLoading('VERIFICANDO ACCESO…');

    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const token = res.sessionToken || res.token;
      if (res.ok && token) {
        sessionStorage.setItem(SESSION_KEY, token);
        showSuccess('ACCESO CORRECTO', 1200);
        enterApp();
      } else {
        hideFeedback();
        if (userInp) userInp.classList.add('input-error');
        if (passInp) passInp.classList.add('input-error');
        if (msg) msg.textContent = res.error || 'Usuario o contraseña incorrectos';
      }
    } catch (error) {
      hideFeedback();
      if (userInp) userInp.classList.add('input-error');
      if (passInp) passInp.classList.add('input-error');
      const isNetwork = error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('502') || error.message.includes('503');
      if (msg) {
        msg.textContent = isNetwork
          ? 'Servicio temporalmente no disponible (SAT API)'
          : error.message || 'Usuario o contraseña incorrectos';
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  function updateNow() {
    const now = new Date();
    const timeEl = $('#now-time');
    const dateEl = $('#now-date');
    if (timeEl) timeEl.textContent = fmtDate(now, { hour: '2-digit', minute: '2-digit' });
    if (dateEl) dateEl.textContent = fmtDate(now, { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
  }

  // ==================================================
  // VIEW SWITCHER
  // ==================================================
  function switchView(name) {
    const titles = {
      home: ['PANEL GENERAL', 'Inicio'],
      agenda: ['PLANIFICACIÓN', 'Agenda'],
      clock: ['REGISTRO HORARIO', 'Fichajes'],
      photos: ['BANDEJA DE OFICINA', 'Fotos'],
      chat: ['COMUNICACIÓN', 'Chat Equipo'],
      tools: ['OFICINA CENTRAL', 'Herramientas de Oficina'],
      operators: ['EQUIPO Y ACCESOS', 'Operarios'],
    };
    state.activeView = name;
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    $$('[data-panel]').forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });

    const eyebrow = $('#view-eyebrow');
    const title = $('#view-title');
    if (eyebrow && titles[name]) eyebrow.textContent = titles[name][0];
    if (title && titles[name]) title.textContent = titles[name][1];

    if (name === 'home') renderHome();
    if (name === 'agenda') void loadAgenda();
    if (name === 'clock') void loadClock();
    if (name === 'photos') void loadPhotos();
    if (name === 'chat') void loadChat();
    if (name === 'operators') renderOperators();
  }

  // ==================================================
  // OPERATORS & CHIPS
  // ==================================================
  function normalizeOperator(raw) {
    return {
      operatorId: raw.operatorId || raw.id || raw.operator_id || raw.OPERATOR_ID || '',
      name: raw.name || raw.nombre || raw.NOMBRE || raw.username || raw.USERNAME || 'Operario',
      username: raw.username || raw.usuario || raw.USERNAME || '',
      phone: raw.phone || raw.telefono || raw['TELÉFONO'] || '',
      status: raw.status || raw.estado || raw.ESTADO || 'active',
      photoUrl: raw.photoUrl || raw.PHOTO_URL || '',
      presence: raw.presence || null,
      canCreateJobs: Boolean(raw.canCreateJobs ?? raw.CAN_CREATE_JOBS ?? false),
      panasonicAccess: Boolean(raw.panasonicAccess ?? raw.PANASONIC_ACCESS ?? false),
    };
  }

  function normalizeJob(raw) {
    const dateTime = raw.dateTime || raw.start || raw.scheduledAt || raw.fechaHora || '';
    const split = dateTime ? new Date(dateTime) : null;
    return {
      id: raw.id || raw.jobId || raw.eventId || raw.sa || crypto.randomUUID(),
      sa: raw.sa || raw.SA || raw.workOrder || '',
      type: raw.type || raw.tipo || raw.serviceType || 'Trabajo',
      operatorId: raw.operatorId || raw.operator_id || '',
      client: raw.client || raw.cliente || raw.customer || '',
      phone: raw.phone || raw.telefono || '',
      city: raw.city || raw.poblacion || '',
      address: raw.address || raw.direccion || '',
      date: raw.date || raw.fecha || (split && !Number.isNaN(split.getTime()) ? isoDate(split) : ''),
      time: raw.time || raw.hora || (split && !Number.isNaN(split.getTime()) ? split.toTimeString().slice(0, 5) : ''),
      model: raw.model || raw.modelo || '',
      state: raw.state || raw.estado || 'Pendiente',
      priority: raw.priority || raw.prioridad || 'Normal',
      observations: raw.observations || raw.observaciones || '',
    };
  }

  async function loadOperators() {
    try {
      const payload = await api('/operators');
      const list = Array.isArray(payload) ? payload : payload?.operators || payload?.items || [];
      if (payload?.presence) {
        state.presence = payload.presence;
      }
      state.operators = list.map(normalizeOperator).filter((x) => x.operatorId);
      setConnection(true);
    } catch (error) {
      state.operators = [];
      setConnection(false, 'API NO DISPONIBLE');
      console.warn('Operators:', error);
    }
    renderOperatorTabs();
    renderOperators();
    fillOperatorSelect();
    if (state.activeView === 'home') renderHome();
  }

  function renderOperatorTabs() {
    const root = $('#operator-tabs');
    if (!root) return;

    const chips = [];

    // Chip "TODOS"
    chips.push(`
      <button type="button" class="operator-chip ${state.selectedOperator === 'all' ? 'active' : ''}" data-operator-id="all">
        <div class="operator-chip-avatar">
          <span class="initials">ALL</span>
        </div>
        <div class="operator-chip-info">
          <strong>TODOS</strong>
          <span>Ver todo</span>
        </div>
      </button>
    `);

    // Chip for each operator
    state.operators.forEach((op) => {
      const isSelected = state.selectedOperator === op.operatorId;
      const opSum = state.operatorsSummary[op.operatorId] || {};

      const stateClass = op.status === 'disabled'
        ? 'state-disabled'
        : opSum.state === 'TRABAJANDO'
        ? 'state-working'
        : opSum.state === 'PAUSA'
        ? 'state-paused'
        : 'state-finished';

      const stateLabel = op.status === 'disabled'
        ? 'DESACTIVADO'
        : opSum.state === 'TRABAJANDO'
        ? `TRABAJANDO${opSum.worked && opSum.worked !== '0h 0m' ? ` · ${opSum.worked}` : ''}`
        : opSum.state === 'PAUSA'
        ? 'EN PAUSA'
        : 'JORNADA FINALIZADA';

      const initials = getOperatorInitials(op.name);

      chips.push(`
        <button type="button" class="operator-chip ${isSelected ? 'active' : ''} ${stateClass}" data-operator-id="${esc(op.operatorId)}">
          <div class="operator-chip-avatar ${stateClass}">
            ${op.photoUrl ? `<img src="${esc(op.photoUrl)}" alt="${esc(op.name)}" />` : `<span class="initials">${esc(initials)}</span>`}
          </div>
          <div class="operator-chip-info">
            <strong>${esc(op.name).toUpperCase()}</strong>
            <span class="work-status ${stateClass}">${esc(stateLabel)}</span>
          </div>
        </button>
      `);
    });

    root.innerHTML = chips.join('');
    root.querySelectorAll('.operator-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.operatorId;
        if (id === 'all') {
          state.selectedOperator = 'all';
          renderOperatorTabs();
          closeOperatorDrawer();
          void Promise.all([loadAgenda(), loadClock(), loadPhotos()]);
          if (state.activeView === 'home') renderHome();
        } else {
          openOperatorDrawer(id);
        }
      });
    });
  }

  // ==================================================
  // OPERATOR LATERAL DRAWER
  // ==================================================
  function openOperatorDrawer(operatorId) {
    const op = state.operators.find((x) => x.operatorId === operatorId);
    if (!op) return;
    state.drawerOperator = op;

    const opSum = state.operatorsSummary[op.operatorId] || {};

    const stateClass = op.status === 'disabled'
      ? 'state-disabled'
      : opSum.state === 'TRABAJANDO'
      ? 'state-working'
      : opSum.state === 'PAUSA'
      ? 'state-paused'
      : 'state-finished';

    const stateLabel = op.status === 'disabled'
      ? 'DESACTIVADO'
      : opSum.state === 'TRABAJANDO'
      ? 'TRABAJANDO'
      : opSum.state === 'PAUSA'
      ? 'EN PAUSA'
      : 'JORNADA FINALIZADA';

    const initials = getOperatorInitials(op.name);

    if ($('#drawer-operator-name')) $('#drawer-operator-name').textContent = op.name.toUpperCase();
    if ($('#drawer-name')) $('#drawer-name').textContent = op.name;
    if ($('#drawer-username')) $('#drawer-username').textContent = `@${op.username}`;
    if ($('#drawer-phone')) $('#drawer-phone').textContent = op.phone ? `Tel: ${op.phone}` : 'Tel: —';

    const avatarWrap = $('#drawer-avatar-wrap');
    if (avatarWrap) avatarWrap.className = `drawer-avatar-wrap ${stateClass}`;

    const avatar = $('#drawer-avatar');
    if (avatar) {
      avatar.innerHTML = op.photoUrl
        ? `<img src="${esc(op.photoUrl)}" alt="${esc(op.name)}" />`
        : `<span class="initials">${esc(initials)}</span>`;
    }

    const workEl = $('#drawer-work-status');
    if (workEl) {
      workEl.textContent = stateLabel;
      workEl.className = `work-status ${stateClass}`;
    }

    const entryEl = $('#drawer-entry-time');
    if (entryEl) {
      entryEl.textContent = opSum.in || '—';
    }

    const exitEl = $('#drawer-exit-time');
    if (exitEl) {
      exitEl.textContent = opSum.out || '—';
    }

    const todayWorkedEl = $('#drawer-today-worked');
    if (todayWorkedEl) {
      todayWorkedEl.textContent = opSum.worked || '0h 0m';
    }

    const badgesEl = $('#drawer-badges');
    if (badgesEl) {
      badgesEl.innerHTML = `
        <span class="badge ${op.canCreateJobs ? 'ok' : 'muted'}">${op.canCreateJobs ? 'CREA TRABAJOS' : 'SOLO LECTURA'}</span>
        <span class="badge ${op.panasonicAccess ? 'ok' : 'muted'}">${op.panasonicAccess ? 'PANASONIC' : 'GENERAL'}</span>
      `;
    }

    const drawer = $('#operator-drawer');
    const backdrop = $('#drawer-backdrop');
    if (drawer) drawer.hidden = false;
    if (backdrop) backdrop.hidden = false;
  }

  function closeOperatorDrawer() {
    const drawer = $('#operator-drawer');
    const backdrop = $('#drawer-backdrop');
    if (drawer) drawer.hidden = true;
    if (backdrop) backdrop.hidden = true;
    state.drawerOperator = null;
  }

  function renderOperators() {
    const body = $('#operators-body');
    if (!body) return;
    if (!state.operators.length) {
      body.innerHTML = '<tr><td colspan="6">No hay operarios cargados.</td></tr>';
      return;
    }
    body.innerHTML = state.operators.map((op) => {
      const initials = getOperatorInitials(op.name);
      const photoHtml = op.photoUrl
        ? `<img src="${esc(op.photoUrl)}" alt="${esc(op.name)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px;" />`
        : `<span style="display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#222;color:#aaa;font-size:10px;font-weight:800;vertical-align:middle;margin-right:8px;">${esc(initials)}</span>`;

      return `<tr>
        <td>${photoHtml}<strong>${esc(op.name)}</strong><br><span style="font-size:9px;color:#666;">${esc(op.operatorId)}</span></td>
        <td>${esc(op.username)}</td>
        <td>${esc(op.phone || '—')}</td>
        <td>
          <span class="badge ${op.canCreateJobs ? 'ok' : 'muted'}">${op.canCreateJobs ? 'CREA TRABAJOS' : 'SOLO LECTURA'}</span>
          <span class="badge ${op.panasonicAccess ? 'ok' : 'muted'}">${op.panasonicAccess ? 'PANASONIC' : 'GENERAL'}</span>
        </td>
        <td>${esc(op.status).toUpperCase()}</td>
        <td>
          <button class="operator-action" data-edit-operator="${esc(op.operatorId)}">EDITAR</button>
          <button class="operator-action ${op.status === 'disabled' ? '' : 'danger'}" data-toggle-operator="${esc(op.operatorId)}">${op.status === 'disabled' ? 'ACTIVAR' : 'DESACTIVAR'}</button>
        </td>
      </tr>`;
    }).join('');

    $$('[data-edit-operator]').forEach((b) => b.addEventListener('click', () => openOperatorDialog(b.dataset.editOperator)));
    $$('[data-toggle-operator]').forEach((b) => b.addEventListener('click', () => void toggleOperator(b.dataset.toggleOperator)));
  }

  function fillOperatorSelect() {
    const select = $('#job-operator');
    if (!select) return;
    select.innerHTML = '<option value="">Selecciona operario</option>' + state.operators.filter((op) => op.status !== 'disabled').map((op) => `<option value="${esc(op.operatorId)}">${esc(op.name)}</option>`).join('');
  }

  async function toggleOperator(id) {
    const op = state.operators.find((x) => x.operatorId === id);
    if (!op) return;
    const status = op.status === 'disabled' ? 'active' : 'disabled';
    showLoading('ACTUALIZANDO ESTADO…');
    try {
      await api(`/operators/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      await loadOperators();
      showSuccess(`OPERARIO ${status === 'active' ? 'ACTIVADO' : 'DESACTIVADO'}`);
    } catch (error) {
      showError('ERROR AL CAMBIAR ESTADO', error.message, () => toggleOperator(id));
    }
  }

  // ==================================================
  // INICIO / DASHBOARD RENDERING
  // ==================================================
  function renderHome() {
    // 1. Team status list
    const teamList = $('#home-operators-list');
    if (teamList) {
      if (!state.operators.length) {
        teamList.innerHTML = '<div class="empty">No hay operarios registrados</div>';
      } else {
        teamList.innerHTML = state.operators.map((op) => {
          const opSum = state.operatorsSummary[op.operatorId] || {};

          const stateClass = op.status === 'disabled'
            ? 'state-disabled'
            : opSum.state === 'TRABAJANDO'
            ? 'state-working'
            : opSum.state === 'PAUSA'
            ? 'state-paused'
            : 'state-finished';

          const stateLabel = op.status === 'disabled'
            ? 'DESACTIVADO'
            : opSum.state === 'TRABAJANDO'
            ? 'TRABAJANDO'
            : opSum.state === 'PAUSA'
            ? 'EN PAUSA'
            : 'JORNADA FINALIZADA';

          const initials = getOperatorInitials(op.name);

          return `
            <div class="home-operator-card" data-open-drawer="${esc(op.operatorId)}">
              <div class="operator-chip-avatar ${stateClass}" style="width:36px;height:36px;">
                ${op.photoUrl ? `<img src="${esc(op.photoUrl)}" alt="${esc(op.name)}" />` : `<span class="initials" style="font-size:12px;">${esc(initials)}</span>`}
              </div>
              <div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;">
                <strong style="font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(op.name).toUpperCase()}</strong>
                <span class="work-status ${stateClass}" style="font-size:10px;font-weight:700;">${esc(stateLabel)}</span>
              </div>
              <div style="text-align:right;display:flex;flex-direction:column;gap:2px;">
                <span style="font-size:11px;color:var(--text-muted);">${esc(opSum.in && opSum.in !== '—' ? `Entrada ${opSum.in}` : 'Sin entrada')}</span>
                <strong style="font-size:11px;color:var(--accent,#00e5ff);">${esc(opSum.worked || '0h 0m')}</strong>
              </div>
            </div>
          `;
        }).join('');

        teamList.querySelectorAll('[data-open-drawer]').forEach((card) => {
          card.addEventListener('click', () => openOperatorDrawer(card.dataset.openDrawer));
        });
      }
    }

    // 2. Today's jobs
    const today = isoDate(new Date());
    const todayJobs = state.agenda.filter((j) => j.date === today).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const todayList = $('#today-list');
    if (todayList) {
      if (!todayJobs.length) {
        todayList.innerHTML = '<div class="empty">Sin trabajos asignados para hoy.</div>';
      } else {
        todayList.innerHTML = todayJobs.map((j) => `
          <div class="home-job-item" data-job-id="${esc(j.id)}">
            <div class="home-job-time">${esc(j.time || '—')}</div>
            <div class="home-job-info">
              <div style="display:flex;gap:6px;align-items:center;">
                <strong>${esc(j.sa || 'SA')}</strong>
                <span class="badge muted" style="font-size:9px;">${esc(j.type || 'Avería')}</span>
              </div>
              <span class="home-job-client">${esc(j.client || '—')} · ${esc(j.city || '')}</span>
            </div>
            <div class="home-job-operator">${esc(operatorName(j.operatorId))}</div>
          </div>
        `).join('');
        todayList.querySelectorAll('[data-job-id]').forEach((item) => {
          item.addEventListener('click', () => openJobDialog(item.dataset.jobId));
        });
      }
    }

    // 3. Upcoming jobs
    const upcomingList = $('#home-upcoming-jobs');
    if (upcomingList) {
      const futureJobs = state.agenda.filter((j) => j.date > today).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')).slice(0, 5);
      if (!futureJobs.length) {
        upcomingList.innerHTML = '<div class="empty">Sin trabajos futuros programados.</div>';
      } else {
        upcomingList.innerHTML = futureJobs.map((j) => `
          <div class="home-job-item" data-job-id="${esc(j.id)}">
            <div class="home-job-time" style="font-size:10px;">${esc(formatDayHeader(j.date))}</div>
            <div class="home-job-info">
              <div style="display:flex;gap:6px;align-items:center;">
                <strong>${esc(j.sa || 'SA')}</strong>
                <span style="font-size:11px;color:var(--text-muted);">${esc(j.time || '')}</span>
              </div>
              <span class="home-job-client">${esc(j.client || '—')} · ${esc(j.city || '')}</span>
            </div>
            <div class="home-job-operator">${esc(operatorName(j.operatorId))}</div>
          </div>
        `).join('');
        upcomingList.querySelectorAll('[data-job-id]').forEach((item) => {
          item.addEventListener('click', () => openJobDialog(item.dataset.jobId));
        });
      }
    }

    // 4. Recent photos
    const recentPhotosList = $('#recent-photos');
    if (recentPhotosList) {
      const recent = state.photos.slice(0, 6);
      if (!recent.length) {
        recentPhotosList.innerHTML = '<div class="empty">Sin fotos recientes</div>';
      } else {
        recentPhotosList.innerHTML = recent.map((p) => `
          <div class="home-photo-thumbnail" title="${esc(p.sa || p.client || '')}">
            <img src="${esc(p.url || p.photoUrl || '')}" alt="${esc(p.sa || 'Foto')}" loading="lazy" />
          </div>
        `).join('');
      }
    }

    // 5. Chat preview
    const chatPreview = $('#home-chat-preview');
    if (chatPreview) {
      const lastMessages = state.chatMessages.slice(-4);
      if (!lastMessages.length) {
        chatPreview.innerHTML = '<div class="empty">No hay mensajes recientes en el chat</div>';
      } else {
        chatPreview.innerHTML = lastMessages.map((m) => `
          <div class="home-chat-msg-row">
            <strong style="color:${m.sender_role === 'office' ? 'var(--accent,#00e5ff)' : 'var(--text,#e5e7eb)'};">${esc(m.sender_name)}:</strong>
            <span>${esc(m.body)}</span>
            <span class="home-chat-msg-time">${esc(formatChatTime(m.created_at))}</span>
          </div>
        `).join('');
      }
    }
  }

  // ==================================================
  // AGENDA
  // ==================================================
  async function loadAgenda() {
    const status = $('#agenda-status');
    if (status) status.textContent = 'Cargando agenda…';
    const operator = state.selectedOperator === 'all' ? '' : `?operatorId=${encodeURIComponent(state.selectedOperator)}`;
    try {
      const payload = await api(`/agenda${operator}`);
      state.agenda = Array.isArray(payload) ? payload : payload?.jobs || payload?.items || [];
      if (status) status.textContent = `${state.agenda.length} trabajos cargados`;
    } catch {
      state.agenda = [];
      if (status) status.textContent = 'Error al cargar agenda';
    }
    renderWeek();
    if (state.activeView === 'home') renderHome();
  }

  function renderWeek() {
    const end = addDays(state.weekStart, 6);
    const rangeEl = $('#week-range');
    if (rangeEl) {
      rangeEl.textContent = `${fmtDate(state.weekStart, { day: '2-digit', month: 'short' })} — ${fmtDate(end, { day: '2-digit', month: 'short', year: 'numeric' })}`.toUpperCase();
    }
    const today = isoDate(new Date());
    const grid = $('#week-grid');
    if (!grid) return;

    grid.innerHTML = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(state.weekStart, i);
      const date = isoDate(day);
      const jobs = state.agenda.filter((j) => j.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      return `<div class="day-column ${date === today ? 'today' : ''}"><div class="day-head"><strong>${fmtDate(day, { weekday: 'short' }).toUpperCase()} ${day.getDate()}</strong><span>${jobs.length} trabajo${jobs.length === 1 ? '' : 's'}</span></div><div class="job-list">${jobs.map((j) => `<article class="job-card" data-job-id="${esc(j.id)}"><time>${esc(j.time || '--:--')}</time><strong>${esc(j.sa || j.client || 'TRABAJO')}</strong><span>${esc(j.client)}</span><span>${esc(j.city)}</span></article>`).join('')}</div></div>`;
    }).join('');
    $$('[data-job-id]').forEach((card) => card.addEventListener('click', () => openJobDialog(card.dataset.jobId)));
  }

  function selectedOperatorName() {
    if (state.selectedOperator === 'all') return 'TODOS';
    return state.operators.find((x) => x.operatorId === state.selectedOperator)?.name || 'OPERARIO';
  }

  // ==================================================
  // CLOCK / FICHAJES
  // ==================================================
  async function loadClock() {
    const operator = state.selectedOperator === 'all' ? '' : `operatorId=${encodeURIComponent(state.selectedOperator)}&`;
    try {
      const payload = await api(`/clock?${operator}period=${state.period}`);
      state.clock = Array.isArray(payload) ? payload : payload?.records || payload?.items || [];
      if (payload?.operatorsSummary) {
        state.operatorsSummary = payload.operatorsSummary;
      }
      renderClock(payload);
      renderOperatorTabs();
      if (state.activeView === 'home') renderHome();
    } catch {
      state.clock = [];
      renderClock(null);
    }
  }

  function renderClock(payload) {
    const summary = payload?.summary || {};
    const nameEl = $('#operator-status-name');
    if (nameEl) nameEl.textContent = selectedOperatorName().toUpperCase();

    const currentState = summary.state || summary.status || 'JORNADA FINALIZADA';
    const isWorking = String(currentState).toLowerCase().includes('trabaj');
    const isPaused = String(currentState).toLowerCase().includes('paus');
    const displayState = isWorking ? 'TRABAJANDO' : isPaused ? 'EN PAUSA' : 'JORNADA FINALIZADA';
    const stateClass = isWorking ? 'working' : isPaused ? 'paused' : 'finished';

    const shiftEl = $('#shift-state');
    if (shiftEl) {
      shiftEl.textContent = displayState;
      shiftEl.className = `shift-state ${stateClass}`;
    }

    const inEl = $('#today-in');
    if (inEl) inEl.textContent = summary.firstEntry || summary.in || '—';

    const outEl = $('#today-out');
    if (outEl) outEl.textContent = summary.lastExit || summary.out || '—';

    const workedEl = $('#today-worked');
    if (workedEl) workedEl.textContent = summary.worked || summary.total || '0h 0m';

    const clockBody = $('#clock-body');
    if (clockBody) {
      const rows = state.clock;
      clockBody.innerHTML = rows.length ? rows.map((r) => {
        const rowState = String(r.status || r.estado || 'FUERA').toUpperCase();
        const rowStateLabel = rowState.includes('TRABAJ') ? 'TRABAJANDO' : rowState.includes('PAUS') ? 'EN PAUSA' : 'JORNADA FINALIZADA';
        const rowClass = rowState.includes('TRABAJ') ? 'ok' : rowState.includes('PAUS') ? 'warn' : 'muted';
        return `<tr>
          <td>${esc(r.date || r.fecha || '—')}</td>
          <td>${esc(r.in || r.entrada || '—')}</td>
          <td>${esc(r.pauses || r.pausas || '—')}</td>
          <td>${esc(r.out || r.salida || '—')}</td>
          <td>${esc(r.total || '—')}</td>
          <td><span class="badge ${rowClass}">${esc(rowStateLabel)}</span></td>
        </tr>`;
      }).join('') : '<tr><td colspan="6">Sin registros disponibles.</td></tr>';
    }
  }

  // ==================================================
  // PHOTOS
  // ==================================================
  async function loadPhotos() {
    const operator = state.selectedOperator === 'all' ? '' : `?operatorId=${encodeURIComponent(state.selectedOperator)}`;
    try {
      const payload = await api(`/photos${operator}`);
      state.photos = Array.isArray(payload) ? payload : payload?.photos || payload?.items || [];
    } catch {
      state.photos = [];
    }
    renderPhotos();
    if (state.activeView === 'home') renderHome();
  }

  function renderPhotos() {
    const searchEl = $('#photo-search');
    const query = (searchEl?.value || '').trim().toLowerCase();
    const filtered = state.photos.filter((p) => !query || `${p.sa || ''} ${p.client || p.cliente || ''} ${p.note || p.nota || ''}`.toLowerCase().includes(query));
    const root = $('#photo-grid');
    if (root) {
      root.innerHTML = filtered.length ? filtered.map((p) => `<article class="photo-card"><img src="${esc(p.url || p.photoUrl || '')}" alt="Foto ${esc(p.sa || '')}" loading="lazy"/><div><strong>${esc(p.sa || p.client || p.cliente || 'FOTO')}</strong><span>${esc(p.client || p.cliente || '')}</span><span>${esc(p.timestamp || p.date || '')}</span></div></article>`).join('') : '<div class="empty">Sin fotos recibidas</div>';
    }
    const badge = $('#photos-badge');
    if (badge) {
      badge.hidden = !state.photos.length;
      badge.textContent = state.photos.length;
    }
  }

  // ==================================================
  // JOB DIALOG
  // ==================================================
  function openJobDialog(id = '') {
    const form = $('#job-form');
    if (!form) return;
    form.reset();
    fillOperatorSelect();
    const job = state.agenda.find((j) => String(j.id) === String(id));
    const titleEl = $('#job-dialog-title');
    if (titleEl) titleEl.textContent = job ? 'Editar trabajo' : 'Nuevo trabajo';
    if (job) {
      Object.entries(job).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value ?? ''; });
    } else {
      if (form.elements.date) form.elements.date.value = isoDate(new Date());
      if (state.selectedOperator !== 'all' && form.elements.operatorId) form.elements.operatorId.value = state.selectedOperator;
    }
    const msgEl = $('#job-message');
    if (msgEl) msgEl.textContent = '';
    const dialog = $('#job-dialog');
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  }

  async function saveJob(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const msgEl = $('#job-message');
    if (msgEl) msgEl.textContent = 'Guardando…';

    showLoading('GUARDANDO TRABAJO…');
    try {
      const editing = Boolean(data.id);
      await api('/agenda', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(data) });
      const dialog = $('#job-dialog');
      if (dialog && typeof dialog.close === 'function') dialog.close();
      await loadAgenda();
      showSuccess('TRABAJO GUARDADO');
    } catch (error) {
      if (msgEl) msgEl.textContent = `No se ha podido guardar: ${error.message}`;
      showError('ERROR AL GUARDAR TRABAJO', error.message);
    }
  }

  // ==================================================
  // OPERATOR DIALOG
  // ==================================================
  function openOperatorDialog(id = '') {
    const form = $('#operator-form');
    if (!form) return;
    form.reset();
    const op = state.operators.find((x) => x.operatorId === id);
    const titleEl = $('#operator-dialog-title');
    if (titleEl) titleEl.textContent = op ? 'Editar operario' : 'Nuevo operario';
    if (op) {
      if (form.elements.operatorId) form.elements.operatorId.value = op.operatorId;
      if (form.elements.name) form.elements.name.value = op.name;
      if (form.elements.username) form.elements.username.value = op.username;
      if (form.elements.phone) form.elements.phone.value = op.phone;
      if (form.elements.canCreateJobs) form.elements.canCreateJobs.checked = Boolean(op.canCreateJobs);
      if (form.elements.panasonicAccess) form.elements.panasonicAccess.checked = Boolean(op.panasonicAccess);
    } else {
      if (form.elements.canCreateJobs) form.elements.canCreateJobs.checked = false;
      if (form.elements.panasonicAccess) form.elements.panasonicAccess.checked = false;
    }
    const msgEl = $('#operator-message');
    if (msgEl) msgEl.textContent = '';
    const dialog = $('#operator-dialog');
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  }

  async function saveOperator(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const id = data.operatorId;
    const canCreateJobs = Boolean(form.elements.canCreateJobs?.checked);
    const panasonicAccess = Boolean(form.elements.panasonicAccess?.checked);
    const msgEl = $('#operator-message');

    if (!id && !data.password) {
      if (msgEl) msgEl.textContent = 'Introduce una contraseña inicial.';
      return;
    }
    if (msgEl) msgEl.textContent = 'Guardando…';

    showLoading('GUARDANDO OPERARIO…');
    try {
      if (id) {
        await api(`/operators/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify({ name: data.name, username: data.username, phone: data.phone, canCreateJobs, panasonicAccess }),
        });
        if (data.password) {
          await api(`/operators/${encodeURIComponent(id)}/password`, { method: 'PUT', body: JSON.stringify({ password: data.password }) });
        }
      } else {
        await api('/operators', {
          method: 'POST',
          body: JSON.stringify({
            name: data.name,
            username: data.username,
            phone: data.phone,
            password: data.password,
            role: 'installer',
            canCreateJobs,
            panasonicAccess,
            selfEditableFields: ['photo'],
          }),
        });
      }
      const dialog = $('#operator-dialog');
      if (dialog && typeof dialog.close === 'function') dialog.close();
      await loadOperators();
      showSuccess('OPERARIO GUARDADO');
    } catch (error) {
      if (msgEl) msgEl.textContent = `No se ha podido guardar: ${error.message}`;
      showError('ERROR AL GUARDAR OPERARIO', error.message);
    }
  }

  // ==================================================
  // CHAT SYSTEM
  // ==================================================
  async function loadChat(silent = false) {
    try {
      const res = await api('/chat/rooms/room_general/messages');
      const messages = Array.isArray(res) ? res : res?.messages || [];
      state.chatMessages = messages;
      renderChat();
      if (!silent) {
        const stream = $('#lab-chat-messages');
        if (stream) stream.scrollTop = stream.scrollHeight;
      }
      await checkChatUnread();
      if (state.activeView === 'home') renderHome();
    } catch (err) {
      if (!silent) {
        const stream = $('#lab-chat-messages');
        if (stream) stream.innerHTML = `<div class="empty">Error al cargar chat: ${esc(err.message)}</div>`;
      }
    }
  }

  function renderChat() {
    const stream = $('#lab-chat-messages');
    if (!stream) return;
    if (!state.chatMessages.length) {
      stream.innerHTML = '<div class="empty">Sin mensajes en el chat de equipo.</div>';
      return;
    }

    const wasAtBottom = stream.scrollHeight - stream.scrollTop <= stream.clientHeight + 80;

    stream.innerHTML = state.chatMessages.map((m) => {
      const isOffice = m.sender_id === 'office' || m.sender_role === 'office';
      const initials = getOperatorInitials(m.sender_name || 'Técnico');
      const photoHtml = m.sender_photo_url
        ? `<img src="${esc(m.sender_photo_url)}" alt="${esc(m.sender_name)}" class="chat-avatar-img" />`
        : `<span class="chat-avatar-initials ${isOffice ? 'office' : ''}">${isOffice ? 'OF' : esc(initials)}</span>`;

      const timeStr = m.created_at ? fmtDate(new Date(m.created_at), { hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div class="lab-chat-row ${isOffice ? 'office' : 'tech'}">
          <div class="lab-chat-avatar">${photoHtml}</div>
          <div class="lab-chat-bubble-wrap">
            <div class="lab-chat-meta">
              <strong>${esc(m.sender_name)}</strong>
              ${isOffice ? '<span class="badge ok">OFICINA</span>' : '<span class="badge muted">TÉCNICO</span>'}
              <time>${esc(timeStr)}</time>
            </div>
            <div class="lab-chat-bubble ${isOffice ? 'office-bubble' : ''}">
              <p>${esc(m.body)}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (wasAtBottom) {
      stream.scrollTop = stream.scrollHeight;
    }
  }

  async function sendOfficeChatMessage(event) {
    event.preventDefault();
    const input = $('#lab-chat-input');
    const submitBtn = $('#lab-chat-submit-btn');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    if (submitBtn) submitBtn.disabled = true;
    showLoading('ENVIANDO MENSAJE…');

    try {
      const res = await api('/chat/rooms/room_general/messages', {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      if (res.message) {
        state.chatMessages.push(res.message);
        renderChat();
        const stream = $('#lab-chat-messages');
        if (stream) stream.scrollTop = stream.scrollHeight;
      }
      showSuccess('MENSAJE ENVIADO', 1200);
    } catch (err) {
      input.value = text;
      showError('ERROR AL ENVIAR MENSAJE', err.message);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function checkChatUnread() {
    try {
      const res = await api('/chat/unread-count');
      const count = res?.unreadCount || 0;
      const badge = $('#lab-chat-badge');
      if (badge) {
        badge.hidden = count <= 0;
        badge.textContent = count > 99 ? '99+' : count;
      }
    } catch {
      // silent
    }
  }

  // ==================================================
  // REFRESH ORCHESTRATION
  // ==================================================
  async function refreshAllSilently() {
    try {
      await loadOperators();
      if (state.activeView === 'home') {
        await Promise.all([loadAgenda(), loadClock(), loadPhotos(), loadChat(true)]);
      } else if (state.activeView === 'agenda') await loadAgenda();
      else if (state.activeView === 'clock') await loadClock();
      else if (state.activeView === 'photos') await loadPhotos();
      else if (state.activeView === 'chat') await loadChat(true);
      await checkChatUnread();
    } catch {
      // silent
    }
  }

  async function refreshAll(showExplicitFeedback = false) {
    const reloadBtn = $('#reload-button');
    if (reloadBtn && showExplicitFeedback) reloadBtn.disabled = true;

    if (showExplicitFeedback) showLoading('ACTUALIZANDO DATOS…');

    try {
      await loadOperators();
      await Promise.all([loadAgenda(), loadClock(), loadPhotos(), loadChat(true)]);
      await checkChatUnread();
      if (showExplicitFeedback) showSuccess('DATOS ACTUALIZADOS');
    } catch (error) {
      if (showExplicitFeedback) {
        showError('NO SE HA PODIDO ACTUALIZAR', error.message, () => refreshAll(true));
      }
    } finally {
      if (reloadBtn && showExplicitFeedback) reloadBtn.disabled = false;
    }
  }

  // ==================================================
  // EVENT BINDINGS
  // ==================================================
  function bind() {
    $('#login-form')?.addEventListener('submit', handleLogin);
    $('#logout-button')?.addEventListener('click', logout);
    $('#reload-button')?.addEventListener('click', () => void refreshAll(true));

    $$('.nav-item').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));

    $('#prev-week')?.addEventListener('click', () => {
      state.weekStart = addDays(state.weekStart, -7);
      void loadAgenda();
    });
    $('#next-week')?.addEventListener('click', () => {
      state.weekStart = addDays(state.weekStart, 7);
      void loadAgenda();
    });
    $('#this-week')?.addEventListener('click', () => {
      state.weekStart = startOfWeek(new Date());
      void loadAgenda();
    });

    $('#new-job-button')?.addEventListener('click', () => openJobDialog());
    $('#new-operator-button')?.addEventListener('click', () => openOperatorDialog());
    $('#job-form')?.addEventListener('submit', saveJob);
    $('#operator-form')?.addEventListener('submit', saveOperator);

    $('#lab-chat-form')?.addEventListener('submit', sendOfficeChatMessage);
    $('#refresh-chat-button')?.addEventListener('click', () => void loadChat());

    $$('[data-close]').forEach((b) => {
      b.addEventListener('click', () => {
        const modal = document.getElementById(b.dataset.close);
        if (modal && typeof modal.close === 'function') modal.close();
      });
    });

    $$('[data-period]').forEach((b) => {
      b.addEventListener('click', () => {
        $$('[data-period]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        state.period = b.dataset.period;
        void loadClock();
      });
    });

    $('#photo-search')?.addEventListener('input', renderPhotos);

    // Operator drawer bindings
    $('#drawer-close-btn')?.addEventListener('click', closeOperatorDrawer);
    $('#drawer-backdrop')?.addEventListener('click', closeOperatorDrawer);

    $('#drawer-btn-agenda')?.addEventListener('click', () => {
      if (state.drawerOperator) {
        state.selectedOperator = state.drawerOperator.operatorId;
        renderOperatorTabs();
      }
      switchView('agenda');
      closeOperatorDrawer();
    });

    $('#drawer-btn-clock')?.addEventListener('click', () => {
      if (state.drawerOperator) {
        state.selectedOperator = state.drawerOperator.operatorId;
        renderOperatorTabs();
      }
      switchView('clock');
      closeOperatorDrawer();
    });

    $('#drawer-btn-photos')?.addEventListener('click', () => {
      if (state.drawerOperator) {
        state.selectedOperator = state.drawerOperator.operatorId;
        renderOperatorTabs();
      }
      switchView('photos');
      closeOperatorDrawer();
    });

    $('#drawer-btn-chat')?.addEventListener('click', () => {
      switchView('chat');
      closeOperatorDrawer();
    });

    $('#drawer-btn-edit')?.addEventListener('click', () => {
      if (state.drawerOperator) {
        openOperatorDialog(state.drawerOperator.operatorId);
      }
      closeOperatorDrawer();
    });

    // Home view card action buttons
    $('#home-view-operators-btn')?.addEventListener('click', () => switchView('operators'));
    $('#home-view-agenda-btn')?.addEventListener('click', () => switchView('agenda'));
    $('#home-view-photos-btn')?.addEventListener('click', () => switchView('photos'));
    $('#home-view-chat-btn')?.addEventListener('click', () => switchView('chat'));

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeOperatorDrawer();
        hideFeedback();
      }
    });

    window.addEventListener('online', () => void refreshAll());
    window.addEventListener('offline', () => setConnection(false, 'SIN RED'));

    setInterval(updateNow, 30000);
    setInterval(() => {
      if (sessionStorage.getItem(SESSION_KEY) && $('#app-shell') && !$('#app-shell').hidden) {
        void refreshAllSilently();
      }
    }, 4000);
  }

  bind();
  if (sessionStorage.getItem(SESSION_KEY)) enterApp();
})();

