(() => {
  'use strict';

  const API = '/lab/api';
  const SESSION_KEY = 'desorden_lab_office_session_v1';

  const state = {
    weekStart: startOfWeek(new Date()),
    selectedOperator: 'all',
    operators: [],
    operatorsSummary: {},
    agenda: [],
    clock: [],
    photos: [],
    period: 'today',
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

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

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function api(path, options = {}) {
    const token = sessionStorage.getItem(SESSION_KEY) || '';
    const response = await fetch(`${API}${path}`, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
      ...options,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `HTTP ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  function setConnection(ok, text) {
    const el = $('#connection-state');
    el.textContent = ok ? `● ${text || 'CONECTADO'}` : `● ${text || 'SIN CONECTAR'}`;
    el.classList.toggle('online', ok);
  }

  function enterApp() {
    $('#login-screen').hidden = true;
    $('#app-shell').hidden = false;
    updateNow();
    void refreshAll();
  }

  async function handleLogin(event) {
    event.preventDefault();
    const username = $('#login-user').value.trim();
    const password = $('#login-pass').value;
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok || !result.sessionToken) throw new Error(result.error || 'Credenciales no válidas');
      sessionStorage.setItem(SESSION_KEY, result.sessionToken);
    } catch {
      $('#login-message').textContent = 'Usuario o contraseña incorrectos.';
      return;
    }
    $('#login-pass').value = '';
    enterApp();
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  function updateNow() {
    const now = new Date();
    $('#now-time').textContent = fmtDate(now, { hour: '2-digit', minute: '2-digit' });
    $('#now-date').textContent = fmtDate(now, { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
  }

  function switchView(name) {
    const titles = {
      agenda: ['PLANIFICACIÓN', 'Agenda'],
      clock: ['REGISTRO HORARIO', 'Fichajes'],
      photos: ['BANDEJA DE OFICINA', 'Fotos'],
      chat: ['COMUNICACIÓN', 'Chat Equipo'],
      operators: ['EQUIPO Y ACCESOS', 'Operarios'],
    };
    state.activeView = name;
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    $$('[data-panel]').forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    $('#view-eyebrow').textContent = titles[name][0];
    $('#view-title').textContent = titles[name][1];
    if (name === 'agenda') void loadAgenda();
    if (name === 'clock') void loadClock();
    if (name === 'photos') void loadPhotos();
    if (name === 'chat') void loadChat();
    if (name === 'operators') renderOperators();
  }

  function normalizeOperator(raw) {
    return {
      operatorId: raw.operatorId || raw.id || raw.operator_id || raw.OPERATOR_ID || '',
      name: raw.name || raw.nombre || raw.NOMBRE || raw.username || raw.USERNAME || 'Operario',
      username: raw.username || raw.usuario || raw.USERNAME || '',
      phone: raw.phone || raw.telefono || raw['TELÉFONO'] || '',
      status: raw.status || raw.estado || raw.ESTADO || 'active',
      photoUrl: raw.photoUrl || raw.PHOTO_URL || '',
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
      observations: raw.observations || raw.observaciones || raw.notes || '',
      status: raw.status || raw.estado || '',
    };
  }

  async function loadOperators() {
    try {
      const payload = await api('/operators');
      const list = Array.isArray(payload) ? payload : payload?.operators || payload?.items || [];
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
        : 'state-inactive';

      const stateLabel = op.status === 'disabled'
        ? 'DESACTIVADO'
        : opSum.state === 'TRABAJANDO'
        ? `TRABAJANDO${opSum.worked && opSum.worked !== '0h 0m' ? ` · ${opSum.worked}` : ''}`
        : opSum.state === 'PAUSA'
        ? 'EN PAUSA'
        : 'FUERA';

      const initials = getOperatorInitials(op.name);

      chips.push(`
        <button type="button" class="operator-chip ${isSelected ? 'active' : ''} ${stateClass}" data-operator-id="${esc(op.operatorId)}">
          <div class="operator-chip-avatar">
            ${op.photoUrl ? `<img src="${esc(op.photoUrl)}" alt="${esc(op.name)}" />` : `<span class="initials">${esc(initials)}</span>`}
          </div>
          <div class="operator-chip-info">
            <strong>${esc(op.name).toUpperCase()}</strong>
            <span>${esc(stateLabel)}</span>
          </div>
        </button>
      `);
    });

    root.innerHTML = chips.join('');
    root.querySelectorAll('.operator-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedOperator = btn.dataset.operatorId;
        renderOperatorTabs();
        void Promise.all([loadAgenda(), loadClock(), loadPhotos()]);
      });
    });
  }

  function renderOperators() {
    const body = $('#operators-body');
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
    select.innerHTML = '<option value="">Selecciona operario</option>' + state.operators.filter((op) => op.status !== 'disabled').map((op) => `<option value="${esc(op.operatorId)}">${esc(op.name)}</option>`).join('');
  }

  async function toggleOperator(id) {
    const op = state.operators.find((x) => x.operatorId === id);
    if (!op) return;
    const status = op.status === 'disabled' ? 'active' : 'disabled';
    try {
      await api(`/operators/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      await loadOperators();
    } catch (error) {
      alert(`No se ha podido cambiar el estado: ${error.message}`);
    }
  }

  async function loadAgenda() {
    const from = isoDate(state.weekStart);
    const to = isoDate(addDays(state.weekStart, 6));
    const operator = state.selectedOperator === 'all' ? '' : `&operatorId=${encodeURIComponent(state.selectedOperator)}`;
    $('#agenda-status').textContent = 'Actualizando agenda…';
    $('#agenda-status').className = 'status-line';
    try {
      const payload = await api(`/agenda?from=${from}&to=${to}${operator}`);
      const list = Array.isArray(payload) ? payload : payload?.agenda || payload?.items || payload?.jobs || [];
      state.agenda = list.map(normalizeJob);
      $('#agenda-status').textContent = `${state.agenda.length} trabajo${state.agenda.length === 1 ? '' : 's'} · ${from} → ${to}`;
      $('#agenda-status').className = 'status-line ok';
      setConnection(true);
    } catch (error) {
      state.agenda = [];
      $('#agenda-status').textContent = `Agenda no disponible · ${error.message}`;
      $('#agenda-status').className = 'status-line error';
      setConnection(false, 'API NO DISPONIBLE');
    }
    renderWeek();
  }

  function renderWeek() {
    const end = addDays(state.weekStart, 6);
    $('#week-range').textContent = `${fmtDate(state.weekStart, { day: '2-digit', month: 'short' })} — ${fmtDate(end, { day: '2-digit', month: 'short', year: 'numeric' })}`.toUpperCase();
    const today = isoDate(new Date());
    $('#week-grid').innerHTML = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(state.weekStart, i);
      const date = isoDate(day);
      const jobs = state.agenda.filter((j) => j.date === date).sort((a, b) => a.time.localeCompare(b.time));
      return `<div class="day-column ${date === today ? 'today' : ''}"><div class="day-head"><strong>${fmtDate(day, { weekday: 'short' }).toUpperCase()} ${day.getDate()}</strong><span>${jobs.length} trabajo${jobs.length === 1 ? '' : 's'}</span></div><div class="job-list">${jobs.map((j) => `<article class="job-card" data-job-id="${esc(j.id)}"><time>${esc(j.time || '--:--')}</time><strong>${esc(j.sa || j.client || 'TRABAJO')}</strong><span>${esc(j.client)}</span><span>${esc(j.city)}</span></article>`).join('')}</div></div>`;
    }).join('');
    $$('[data-job-id]').forEach((card) => card.addEventListener('click', () => openJobDialog(card.dataset.jobId)));
    renderTodayMini();
  }

  function renderTodayMini() {
    const today = isoDate(new Date());
    const jobs = state.agenda.filter((j) => j.date === today);
    $('#today-list').innerHTML = jobs.length ? jobs.map((j) => `<div>${esc(j.time)} · <strong>${esc(j.sa || j.client)}</strong></div>`).join('') : 'Sin trabajos cargados';
  }

  function selectedOperatorName() {
    if (state.selectedOperator === 'all') return 'TODOS';
    return state.operators.find((x) => x.operatorId === state.selectedOperator)?.name || 'OPERARIO';
  }

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
    } catch {
      state.clock = [];
      renderClock(null);
    }
  }

  function renderClock(payload) {
    const summary = payload?.summary || {};
    $('#operator-status-name').textContent = selectedOperatorName().toUpperCase();
    const currentState = summary.state || summary.status || 'SIN DATOS';
    $('#shift-state').textContent = String(currentState).toUpperCase();
    $('#shift-state').className = `shift-state ${String(currentState).toLowerCase().includes('trabaj') ? 'working' : String(currentState).toLowerCase().includes('paus') ? 'paused' : ''}`;
    $('#last-clock-event').textContent = summary.last || summary.lastEvent || '—';
    $('#today-worked').textContent = summary.worked || summary.total || '—';
    $('#clock-state').textContent = String(currentState).toUpperCase();
    $('#clock-worked').textContent = summary.worked || summary.total || '—';
    $('#clock-paused').textContent = summary.paused || '—';
    $('#clock-last').textContent = summary.last || summary.lastEvent || '—';
    const rows = state.clock;
    $('#clock-body').innerHTML = rows.length ? rows.map((r) => `<tr><td>${esc(r.date || r.fecha || '—')}</td><td>${esc(r.in || r.entrada || '—')}</td><td>${esc(r.pauses || r.pausas || '—')}</td><td>${esc(r.out || r.salida || '—')}</td><td>${esc(r.total || '—')}</td><td>${esc(r.status || r.estado || '—')}</td></tr>`).join('') : '<tr><td colspan="6">Sin registros disponibles.</td></tr>';
  }

  async function loadPhotos() {
    const operator = state.selectedOperator === 'all' ? '' : `?operatorId=${encodeURIComponent(state.selectedOperator)}`;
    try {
      const payload = await api(`/photos${operator}`);
      state.photos = Array.isArray(payload) ? payload : payload?.photos || payload?.items || [];
    } catch {
      state.photos = [];
    }
    renderPhotos();
  }

  function renderPhotos() {
    const query = $('#photo-search').value.trim().toLowerCase();
    const filtered = state.photos.filter((p) => !query || `${p.sa || ''} ${p.client || p.cliente || ''} ${p.note || p.nota || ''}`.toLowerCase().includes(query));
    const root = $('#photo-grid');
    root.innerHTML = filtered.length ? filtered.map((p) => `<article class="photo-card"><img src="${esc(p.url || p.photoUrl || '')}" alt="Foto ${esc(p.sa || '')}" loading="lazy"/><div><strong>${esc(p.sa || p.client || p.cliente || 'FOTO')}</strong><span>${esc(p.client || p.cliente || '')}</span><span>${esc(p.timestamp || p.date || '')}</span></div></article>`).join('') : '<div class="empty">Sin fotos recibidas</div>';
    const badge = $('#photos-badge');
    badge.hidden = !state.photos.length;
    badge.textContent = state.photos.length;
    $('#recent-photos').innerHTML = state.photos.length ? state.photos.slice(0, 3).map((p) => `<div>${esc(p.sa || p.client || p.cliente || 'Foto')}</div>`).join('') : 'Sin fotos recibidas';
  }

  function openJobDialog(id = '') {
    const form = $('#job-form');
    form.reset();
    fillOperatorSelect();
    const job = state.agenda.find((j) => String(j.id) === String(id));
    $('#job-dialog-title').textContent = job ? 'Editar trabajo' : 'Nuevo trabajo';
    if (job) Object.entries(job).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value ?? ''; });
    else {
      form.elements.date.value = isoDate(new Date());
      if (state.selectedOperator !== 'all') form.elements.operatorId.value = state.selectedOperator;
    }
    $('#job-message').textContent = '';
    $('#job-dialog').showModal();
  }

  async function saveJob(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    $('#job-message').textContent = 'Guardando…';
    try {
      const editing = Boolean(data.id);
      await api('/agenda', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(data) });
      $('#job-dialog').close();
      await loadAgenda();
    } catch (error) {
      $('#job-message').textContent = `No se ha podido guardar: ${error.message}`;
    }
  }

  function openOperatorDialog(id = '') {
    const form = $('#operator-form');
    form.reset();
    const op = state.operators.find((x) => x.operatorId === id);
    $('#operator-dialog-title').textContent = op ? 'Editar operario' : 'Nuevo operario';
    if (op) {
      form.elements.operatorId.value = op.operatorId;
      form.elements.name.value = op.name;
      form.elements.username.value = op.username;
      form.elements.phone.value = op.phone;
      if (form.elements.canCreateJobs) {
        form.elements.canCreateJobs.checked = Boolean(op.canCreateJobs);
      }
      if (form.elements.panasonicAccess) {
        form.elements.panasonicAccess.checked = Boolean(op.panasonicAccess);
      }
    } else {
      if (form.elements.canCreateJobs) {
        form.elements.canCreateJobs.checked = false;
      }
      if (form.elements.panasonicAccess) {
        form.elements.panasonicAccess.checked = false;
      }
    }
    $('#operator-message').textContent = '';
    $('#operator-dialog').showModal();
  }

  async function saveOperator(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const id = data.operatorId;
    const canCreateJobs = Boolean(form.elements.canCreateJobs?.checked);
    const panasonicAccess = Boolean(form.elements.panasonicAccess?.checked);

    if (!id && !data.password) {
      $('#operator-message').textContent = 'Introduce una contraseña inicial.';
      return;
    }
    $('#operator-message').textContent = 'Guardando…';
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
      $('#operator-dialog').close();
      await loadOperators();
    } catch (error) {
      $('#operator-message').textContent = `No se ha podido guardar: ${error.message}`;
    }
  }

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
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
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
    } catch (err) {
      alert(`No se ha podido enviar el mensaje: ${err.message}`);
      input.value = text;
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

  async function refreshAllSilently() {
    try {
      await loadOperators();
      if (state.activeView === 'agenda') await loadAgenda();
      else if (state.activeView === 'clock') await loadClock();
      else if (state.activeView === 'photos') await loadPhotos();
      else if (state.activeView === 'chat') await loadChat(true);
      await checkChatUnread();
    } catch {
      // ignore
    }
  }

  async function refreshAll() {
    await loadOperators();
    await Promise.all([loadAgenda(), loadClock(), loadPhotos()]);
    if (state.activeView === 'chat') await loadChat();
    await checkChatUnread();
  }

  function bind() {
    $('#login-form').addEventListener('submit', handleLogin);
    $('#logout-button').addEventListener('click', logout);
    $('#reload-button').addEventListener('click', () => void refreshAll());
    $$('.nav-item').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
    $('#prev-week').addEventListener('click', () => { state.weekStart = addDays(state.weekStart, -7); void loadAgenda(); });
    $('#next-week').addEventListener('click', () => { state.weekStart = addDays(state.weekStart, 7); void loadAgenda(); });
    $('#today-week').addEventListener('click', () => { state.weekStart = startOfWeek(new Date()); void loadAgenda(); });
    $('#new-job-button').addEventListener('click', () => openJobDialog());
    $('#new-operator-button').addEventListener('click', () => openOperatorDialog());
    $('#job-form').addEventListener('submit', saveJob);
    $('#operator-form').addEventListener('submit', saveOperator);
    $('#lab-chat-form')?.addEventListener('submit', sendOfficeChatMessage);
    $('#refresh-chat-button')?.addEventListener('click', () => void loadChat());
    $$('[data-close]').forEach((b) => b.addEventListener('click', () => document.getElementById(b.dataset.close).close()));
    $$('.period').forEach((b) => b.addEventListener('click', () => { $$('.period').forEach((x) => x.classList.remove('active')); b.classList.add('active'); state.period = b.dataset.period; void loadClock(); }));
    $('#photo-search').addEventListener('input', renderPhotos);
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
