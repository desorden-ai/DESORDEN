(() => {
  'use strict';

  const OFFICE_API_BASE = '/lab/api';
  const state = {
    view: 'agenda',
    weekStart: startOfWeek(new Date()),
    agenda: [],
    clock: null,
    photos: [],
    period: 'today',
    loading: false,
    editingId: null,
  };

  const els = {
    navItems: [...document.querySelectorAll('.nav-item[data-view]')],
    views: [...document.querySelectorAll('[data-view-panel]')],
    viewTitle: document.getElementById('view-title'),
    viewEyebrow: document.getElementById('view-eyebrow'),
    nowTime: document.getElementById('now-time'),
    nowDate: document.getElementById('now-date'),
    reload: document.getElementById('reload-button'),
    connectionDot: document.getElementById('connection-dot'),
    connectionLabel: document.getElementById('connection-label'),
    weekGrid: document.getElementById('week-grid'),
    weekTitle: document.getElementById('week-title'),
    weekRange: document.getElementById('week-range'),
    agendaStatus: document.getElementById('agenda-status'),
    prevWeek: document.getElementById('prev-week'),
    nextWeek: document.getElementById('next-week'),
    todayWeek: document.getElementById('today-week'),
    newJob: document.getElementById('new-job-button'),
    todayCount: document.getElementById('today-count'),
    todayList: document.getElementById('today-list'),
    technicianName: document.getElementById('technician-name'),
    shiftState: document.getElementById('shift-state'),
    lastClockEvent: document.getElementById('last-clock-event'),
    todayWorked: document.getElementById('today-worked'),
    clockSummaryState: document.getElementById('clock-summary-state'),
    clockSummaryWorked: document.getElementById('clock-summary-worked'),
    clockSummaryPaused: document.getElementById('clock-summary-paused'),
    clockSummaryLast: document.getElementById('clock-summary-last'),
    clockTable: document.getElementById('clock-table-body'),
    periodTabs: [...document.querySelectorAll('.period-tab')],
    photosBadge: document.getElementById('photos-badge'),
    recentPhotosCount: document.getElementById('recent-photos-count'),
    recentPhotos: document.getElementById('recent-photos'),
    photoGrid: document.getElementById('photo-grid'),
    photoSearch: document.getElementById('photo-search'),
    dialog: document.getElementById('job-dialog'),
    form: document.getElementById('job-form'),
    formStatus: document.getElementById('form-status'),
    closeDialog: document.getElementById('close-dialog'),
    cancelDialog: document.getElementById('cancel-dialog'),
  };

  const VIEW_META = {
    agenda: ['PLANIFICACIÓN', 'Agenda'],
    clock: ['REGISTRO HORARIO', 'Fichajes'],
    photos: ['BANDEJA DE OFICINA', 'Fotos'],
  };

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function startOfWeek(date) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = copy.getDay();
    const delta = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + delta);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function sameDate(a, b) {
    return dateKey(a) === dateKey(b);
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const es = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (es) {
      let year = Number(es[3]);
      if (year < 100) year += 2000;
      return new Date(year, Number(es[2]) - 1, Number(es[1]));
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function normalizeAgendaRow(row, index = 0) {
    const date = row.date || row.fecha || row.DATA || row.data || '';
    const time = row.time || row.hora || row.HORA || '';
    const sa = row.sa || row.SA || '';
    const type = row.type || row.tipo || row.TIPO || '';
    const client = row.client || row.cliente || row.CLIENTE || '';
    const phone = row.phone || row.telefono || row.TELEFONO || '';
    const address = row.address || row.direccion || row.DIRECCION || '';
    const city = row.city || row.poblacion || row.POBLACION || '';
    const observations = row.observations || row.observaciones || row.OBSERVACIONES || '';
    const id = row.id || row.calendarEventId || row.CALENDAR_EVENT_ID || `${sa}-${date}-${time}-${index}`;
    return { id: String(id), date: String(date), time: String(time), sa: String(sa), type: String(type), client: String(client), phone: String(phone), address: String(address), city: String(city), observations: String(observations), raw: row };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatWeekRange(start) {
    const end = addDays(start, 6);
    const month = new Intl.DateTimeFormat('es-ES', { month: 'short' });
    const left = `${start.getDate()} ${month.format(start)}`;
    const right = `${end.getDate()} ${month.format(end)} ${end.getFullYear()}`;
    return `${left} — ${right}`.toUpperCase();
  }

  function formatLongDate(date) {
    return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short' }).format(date).replace('.', '').toUpperCase();
  }

  function setConnection(mode, label) {
    els.connectionDot.classList.remove('is-online', 'is-error');
    if (mode === 'online') els.connectionDot.classList.add('is-online');
    if (mode === 'error') els.connectionDot.classList.add('is-error');
    els.connectionLabel.textContent = label;
  }

  function setAgendaStatus(mode, message) {
    els.agendaStatus.classList.remove('is-online', 'is-error');
    if (mode === 'online') els.agendaStatus.classList.add('is-online');
    if (mode === 'error') els.agendaStatus.classList.add('is-error');
    const text = els.agendaStatus.querySelector('span:last-child');
    if (text) text.textContent = message;
  }

  async function api(path, options = {}) {
    const response = await fetch(`${OFFICE_API_BASE}${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
      ...options,
    });
    let payload = null;
    const text = await response.text();
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = { error: text.slice(0, 300) }; }
    }
    if (!response.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload || {};
  }

  function renderWeek() {
    const now = new Date();
    els.weekTitle.textContent = `SEMANA ${weekNumber(state.weekStart)}`;
    els.weekRange.textContent = formatWeekRange(state.weekStart);
    const days = Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i));
    els.weekGrid.innerHTML = days.map((day) => {
      const key = dateKey(day);
      const entries = state.agenda
        .filter((item) => {
          const parsed = parseDate(item.date);
          return parsed && dateKey(parsed) === key;
        })
        .sort((a, b) => a.time.localeCompare(b.time));
      const cards = entries.length ? entries.map((item) => `
        <button class="event-card" type="button" data-event-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}">
          <span class="event-time">${escapeHtml(item.time || '—')}</span>
          <strong>${escapeHtml(item.sa || item.client || 'Trabajo')}</strong>
          <span>${escapeHtml(item.client || '')}</span>
          <span>${escapeHtml(item.city || item.type || '')}</span>
        </button>`).join('') : '<div class="day-empty">SIN TRABAJOS</div>';
      return `
        <section class="day-column${sameDate(day, now) ? ' is-today' : ''}" data-date="${key}">
          <header class="day-head"><span>${formatLongDate(day).split(' ')[0]}</span><strong>${day.getDate()}</strong></header>
          <div class="day-events">${cards}</div>
        </section>`;
    }).join('');

    els.weekGrid.querySelectorAll('[data-event-id]').forEach((button) => {
      button.addEventListener('click', () => openExistingJob(button.dataset.eventId));
    });
    renderToday();
  }

  function weekNumber(date) {
    const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    return Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
  }

  function renderToday() {
    const key = dateKey(new Date());
    const rows = state.agenda
      .filter((item) => {
        const parsed = parseDate(item.date);
        return parsed && dateKey(parsed) === key;
      })
      .sort((a, b) => a.time.localeCompare(b.time));
    els.todayCount.textContent = String(rows.length);
    if (!rows.length) {
      els.todayList.innerHTML = '<div class="empty-mini">Sin trabajos para hoy</div>';
      return;
    }
    els.todayList.innerHTML = rows.slice(0, 7).map((item) => `
      <div class="today-item">
        <time>${escapeHtml(item.time || '—')}</time>
        <div><strong>${escapeHtml(item.sa || item.client)}</strong><span>${escapeHtml(item.client || item.city || item.type)}</span></div>
      </div>`).join('');
  }

  function renderClock() {
    const data = state.clock;
    if (!data) {
      setShiftState('unknown', 'SIN DATOS');
      els.lastClockEvent.textContent = '—';
      els.todayWorked.textContent = '—';
      els.clockSummaryState.textContent = 'SIN DATOS';
      els.clockSummaryWorked.textContent = '—';
      els.clockSummaryPaused.textContent = '—';
      els.clockSummaryLast.textContent = '—';
      els.clockTable.innerHTML = '<tr class="table-empty"><td colspan="6">El fichaje de la APK todavía no dispone de sincronización remota segura.</td></tr>';
      return;
    }

    const status = data.status || 'inactive';
    const statusLabel = status === 'active' ? 'TRABAJANDO' : status === 'paused' ? 'EN PAUSA' : 'FUERA DE JORNADA';
    setShiftState(status, statusLabel);
    if (data.technician?.name) els.technicianName.textContent = data.technician.name;
    els.lastClockEvent.textContent = data.lastEventLabel || data.lastEvent?.localTimeStr || '—';
    els.todayWorked.textContent = data.today?.workedFormatted || '—';
    els.clockSummaryState.textContent = statusLabel;
    els.clockSummaryWorked.textContent = data.summary?.workedFormatted || data.today?.workedFormatted || '—';
    els.clockSummaryPaused.textContent = data.summary?.pausedFormatted || data.today?.pausedFormatted || '—';
    els.clockSummaryLast.textContent = data.lastEventLabel || data.lastEvent?.localTimeStr || '—';

    const rows = Array.isArray(data.days) ? data.days : [];
    els.clockTable.innerHTML = rows.length ? rows.map((day) => `
      <tr>
        <td>${escapeHtml(day.dateLabel || day.date || '—')}</td>
        <td>${escapeHtml(day.entry || '—')}</td>
        <td>${escapeHtml(day.pauses || day.pausedFormatted || '—')}</td>
        <td>${escapeHtml(day.exit || '—')}</td>
        <td>${escapeHtml(day.workedFormatted || day.total || '—')}</td>
        <td>${escapeHtml(day.status || '—')}</td>
      </tr>`).join('') : '<tr class="table-empty"><td colspan="6">Sin registros para este periodo.</td></tr>';
  }

  function setShiftState(status, label) {
    els.shiftState.className = `shift-state is-${status}`;
    els.shiftState.textContent = label;
  }

  function renderPhotos() {
    const query = (els.photoSearch.value || '').trim().toLowerCase();
    const photos = state.photos.filter((photo) => {
      if (!query) return true;
      return [photo.sa, photo.client, photo.note].some((value) => String(value || '').toLowerCase().includes(query));
    });
    const unread = state.photos.filter((photo) => photo.unread).length;
    els.photosBadge.hidden = unread === 0;
    els.photosBadge.textContent = String(unread);
    els.recentPhotosCount.textContent = String(state.photos.length);

    els.recentPhotos.innerHTML = state.photos.length
      ? state.photos.slice(0, 3).map((photo) => `<div class="today-item"><time>${escapeHtml(photo.time || '')}</time><div><strong>${escapeHtml(photo.sa || 'FOTO')}</strong><span>${escapeHtml(photo.client || photo.note || '')}</span></div></div>`).join('')
      : '<div class="empty-mini">Sin fotos recibidas</div>';

    if (!photos.length) {
      els.photoGrid.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="1"/><path d="m6 17 4-4 3 3 2-2 3 3"/></svg><strong>Sin fotos recibidas</strong><span>La bandeja queda preparada para la acción “Enviar a oficina” desde SAT.</span></div>';
      return;
    }
    els.photoGrid.innerHTML = photos.map((photo) => `
      <article class="photo-card">
        <img src="${escapeHtml(photo.thumbnailUrl || photo.url || '')}" alt="${escapeHtml(photo.sa ? `Foto ${photo.sa}` : 'Foto recibida')}">
        <strong>${escapeHtml(photo.sa || photo.client || 'Foto')}</strong>
        <span>${escapeHtml([photo.client, photo.date, photo.time].filter(Boolean).join(' · '))}</span>
      </article>`).join('');
  }

  async function loadAgenda() {
    const from = dateKey(state.weekStart);
    const to = dateKey(addDays(state.weekStart, 6));
    try {
      const data = await api(`/agenda?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data.agenda) ? data.agenda : [];
      state.agenda = rows.map(normalizeAgendaRow);
      setAgendaStatus('online', `Agenda sincronizada · ${state.agenda.length} trabajos en la semana`);
      setConnection('online', 'SAT conectado');
      renderWeek();
      return true;
    } catch (error) {
      state.agenda = [];
      const unavailable = error.status === 404 || error.status === 401 || error.status === 403;
      setAgendaStatus(unavailable ? 'idle' : 'error', unavailable ? 'Interfaz lista · falta habilitar la pasarela segura de oficina' : `No se pudo cargar la agenda · ${error.message}`);
      setConnection(unavailable ? 'idle' : 'error', unavailable ? 'Pasarela pendiente' : 'Error de conexión');
      renderWeek();
      return false;
    }
  }

  async function loadClock() {
    try {
      state.clock = await api(`/clock?period=${encodeURIComponent(state.period)}`);
    } catch {
      state.clock = null;
    }
    renderClock();
  }

  async function loadPhotos() {
    try {
      const data = await api('/photos?limit=60');
      state.photos = Array.isArray(data.photos) ? data.photos : [];
    } catch {
      state.photos = [];
    }
    renderPhotos();
  }

  async function reloadAll() {
    if (state.loading) return;
    state.loading = true;
    els.reload.classList.add('is-loading');
    els.reload.disabled = true;
    await Promise.allSettled([loadAgenda(), loadClock(), loadPhotos()]);
    els.reload.classList.remove('is-loading');
    els.reload.disabled = false;
    state.loading = false;
  }

  function switchView(view) {
    if (!VIEW_META[view]) return;
    state.view = view;
    els.navItems.forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
    els.views.forEach((panel) => {
      const active = panel.dataset.viewPanel === view;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    els.viewEyebrow.textContent = VIEW_META[view][0];
    els.viewTitle.textContent = VIEW_META[view][1];
  }

  function openNewJob() {
    state.editingId = null;
    els.form.reset();
    els.formStatus.textContent = '';
    els.formStatus.className = 'form-status';
    document.getElementById('job-dialog-title').textContent = 'Nuevo trabajo';
    const dateInput = els.form.elements.namedItem('date');
    const timeInput = els.form.elements.namedItem('time');
    if (dateInput) dateInput.value = dateKey(new Date());
    if (timeInput) timeInput.value = '09:00';
    els.dialog.showModal();
  }

  function openExistingJob(id) {
    const item = state.agenda.find((row) => row.id === id);
    if (!item) return;
    state.editingId = item.id;
    els.formStatus.textContent = '';
    els.formStatus.className = 'form-status';
    document.getElementById('job-dialog-title').textContent = item.sa ? `Editar ${item.sa}` : 'Editar trabajo';
    for (const key of ['sa', 'type', 'client', 'phone', 'city', 'address', 'time', 'observations']) {
      const input = els.form.elements.namedItem(key);
      if (input) input.value = item[key] || '';
    }
    const parsed = parseDate(item.date);
    const dateInput = els.form.elements.namedItem('date');
    if (dateInput) dateInput.value = parsed ? dateKey(parsed) : '';
    els.dialog.showModal();
  }

  async function saveJob(event) {
    event.preventDefault();
    const formData = new FormData(els.form);
    const payload = Object.fromEntries(formData.entries());
    if (state.editingId) payload.id = state.editingId;
    els.formStatus.className = 'form-status';
    els.formStatus.textContent = 'Guardando…';
    const submit = els.form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await api('/agenda', { method: state.editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      els.formStatus.classList.add('is-ok');
      els.formStatus.textContent = 'Guardado en la agenda compartida.';
      await loadAgenda();
      window.setTimeout(() => els.dialog.close(), 450);
    } catch (error) {
      els.formStatus.classList.add('is-error');
      if (error.status === 404 || error.status === 401 || error.status === 403) {
        els.formStatus.textContent = 'La interfaz está lista. Falta habilitar el endpoint seguro de escritura para oficina.';
      } else {
        els.formStatus.textContent = `No se pudo guardar: ${error.message}`;
      }
    } finally {
      submit.disabled = false;
    }
  }

  function updateClock() {
    const now = new Date();
    els.nowTime.textContent = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(now);
    els.nowDate.textContent = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'short' }).format(now);
  }

  function bindEvents() {
    els.navItems.forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
    document.querySelectorAll('[data-go-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.goView)));
    els.reload.addEventListener('click', reloadAll);
    els.prevWeek.addEventListener('click', () => { state.weekStart = addDays(state.weekStart, -7); loadAgenda(); });
    els.nextWeek.addEventListener('click', () => { state.weekStart = addDays(state.weekStart, 7); loadAgenda(); });
    els.todayWeek.addEventListener('click', () => { state.weekStart = startOfWeek(new Date()); loadAgenda(); });
    els.newJob.addEventListener('click', openNewJob);
    els.closeDialog.addEventListener('click', () => els.dialog.close());
    els.cancelDialog.addEventListener('click', () => els.dialog.close());
    els.form.addEventListener('submit', saveJob);
    els.periodTabs.forEach((button) => button.addEventListener('click', () => {
      state.period = button.dataset.period;
      els.periodTabs.forEach((tab) => tab.classList.toggle('is-active', tab === button));
      loadClock();
    }));
    els.photoSearch.addEventListener('input', renderPhotos);
  }

  updateClock();
  window.setInterval(updateClock, 30000);
  bindEvents();
  renderWeek();
  renderClock();
  renderPhotos();
  reloadAll();
})();
