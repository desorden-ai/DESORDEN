(() => {
  'use strict';

  const API_BASE = '/lab/api';
  const state = {
    operators: [],
    selectedOperatorId: 'all',
    editingOperatorId: null,
    originalFetch: window.fetch.bind(window),
  };

  const els = {
    tabs: document.getElementById('operator-tabs'),
    manageButton: document.getElementById('manage-operators-button'),
    operatorsPanel: document.getElementById('view-operators'),
    operatorsBody: document.getElementById('operators-table-body'),
    newOperatorButton: document.getElementById('new-operator-button'),
    operatorDialog: document.getElementById('operator-dialog'),
    operatorForm: document.getElementById('operator-form'),
    operatorDialogTitle: document.getElementById('operator-dialog-title'),
    operatorFormStatus: document.getElementById('operator-form-status'),
    closeOperatorDialog: document.getElementById('close-operator-dialog'),
    cancelOperatorDialog: document.getElementById('cancel-operator-dialog'),
    jobOperatorSelect: document.getElementById('job-operator-select'),
    jobDialog: document.getElementById('job-dialog'),
    reload: document.getElementById('reload-button'),
    viewTitle: document.getElementById('view-title'),
    viewEyebrow: document.getElementById('view-eyebrow'),
    agendaPanel: document.getElementById('view-agenda'),
    clockPanel: document.getElementById('view-clock'),
    photosPanel: document.getElementById('view-photos'),
    navItems: [...document.querySelectorAll('.nav-item[data-view]')],
  };

  if (!els.tabs || !els.operatorsPanel || !els.operatorForm) return;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function operatorName(operator) {
    return String(operator?.name || operator?.displayName || operator?.technicianName || 'Operario').trim();
  }

  function operatorId(operator) {
    return String(operator?.id || operator?.operatorId || operator?.technicianId || '').trim();
  }

  function normalizeOperator(operator, index) {
    return {
      id: operatorId(operator) || `operator-${index + 1}`,
      name: operatorName(operator),
      username: String(operator?.username || operator?.login || '').trim(),
      status: String(operator?.status || (operator?.disabled ? 'disabled' : 'active')).toLowerCase(),
      updatedAt: String(operator?.updatedAt || operator?.passwordUpdatedAt || '').trim(),
    };
  }

  async function api(path, options = {}) {
    const response = await state.originalFetch(`${API_BASE}${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
    const text = await response.text();
    let payload = {};
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = { error: text.slice(0, 250) }; }
    }
    if (!response.ok) {
      const error = new Error(payload.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function installAgendaFetchFilter() {
    window.fetch = async (input, init) => {
      try {
        const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
        if (url.pathname === '/lab/api/agenda' || url.pathname === '/lab/api/clock') {
          if (state.selectedOperatorId !== 'all') {
            url.searchParams.set('operatorId', state.selectedOperatorId);
          }
          const nextInput = typeof input === 'string'
            ? `${url.pathname}${url.search}${url.hash}`
            : new Request(url.toString(), input);
          return state.originalFetch(nextInput, init);
        }
      } catch {
        // Fall through to the original request if URL parsing fails.
      }
      return state.originalFetch(input, init);
    };
  }

  function renderTabs() {
    const all = `<button class="operator-tab${state.selectedOperatorId === 'all' ? ' is-active' : ''}" type="button" data-operator-id="all"><span class="operator-state-dot"></span>TODOS</button>`;
    const tabs = state.operators
      .filter((operator) => operator.status !== 'disabled')
      .map((operator) => `<button class="operator-tab${state.selectedOperatorId === operator.id ? ' is-active' : ''}" type="button" data-operator-id="${escapeHtml(operator.id)}" data-status="${escapeHtml(operator.status)}"><span class="operator-state-dot"></span>${escapeHtml(operator.name)}</button>`)
      .join('');
    els.tabs.innerHTML = all + tabs;
    els.tabs.querySelectorAll('[data-operator-id]').forEach((button) => {
      button.addEventListener('click', () => selectOperator(button.dataset.operatorId || 'all'));
    });
  }

  function renderJobOperatorOptions() {
    if (!els.jobOperatorSelect) return;
    const current = els.jobOperatorSelect.value;
    els.jobOperatorSelect.innerHTML = '<option value="">Selecciona operario</option>' + state.operators
      .filter((operator) => operator.status !== 'disabled')
      .map((operator) => `<option value="${escapeHtml(operator.id)}">${escapeHtml(operator.name)}</option>`)
      .join('');

    const preferred = state.selectedOperatorId !== 'all' ? state.selectedOperatorId : current;
    if (preferred && state.operators.some((operator) => operator.id === preferred && operator.status !== 'disabled')) {
      els.jobOperatorSelect.value = preferred;
    }
  }

  function renderOperatorsTable(message = '') {
    if (!state.operators.length) {
      els.operatorsBody.innerHTML = `<tr class="table-empty"><td colspan="5">${escapeHtml(message || 'No hay operarios creados todavía.')}</td></tr>`;
      return;
    }

    els.operatorsBody.innerHTML = state.operators.map((operator) => `
      <tr>
        <td><div class="operator-name-cell"><strong>${escapeHtml(operator.name)}</strong><span>${escapeHtml(operator.username || operator.id)}</span></div></td>
        <td><span class="operator-status ${operator.status === 'active' ? 'is-active' : 'is-disabled'}">${operator.status === 'active' ? 'ACTIVO' : 'DESACTIVADO'}</span></td>
        <td>${escapeHtml(operator.updatedAt || '—')}</td>
        <td>${operator.status === 'active' ? 'Agenda disponible' : 'Acceso bloqueado'}</td>
        <td><div class="operator-actions">
          <button class="operator-action" type="button" data-reset-password="${escapeHtml(operator.id)}">NUEVA CONTRASEÑA</button>
          <button class="operator-action ${operator.status === 'active' ? 'is-danger' : ''}" type="button" data-toggle-status="${escapeHtml(operator.id)}">${operator.status === 'active' ? 'DESACTIVAR' : 'ACTIVAR'}</button>
        </div></td>
      </tr>`).join('');

    els.operatorsBody.querySelectorAll('[data-reset-password]').forEach((button) => {
      button.addEventListener('click', () => openPasswordReset(button.dataset.resetPassword));
    });
    els.operatorsBody.querySelectorAll('[data-toggle-status]').forEach((button) => {
      button.addEventListener('click', () => toggleStatus(button.dataset.toggleStatus));
    });
  }

  async function loadOperators() {
    try {
      const data = await api('/operators');
      const rows = Array.isArray(data.operators) ? data.operators : Array.isArray(data.rows) ? data.rows : [];
      state.operators = rows.map(normalizeOperator);
      if (state.selectedOperatorId !== 'all' && !state.operators.some((operator) => operator.id === state.selectedOperatorId && operator.status !== 'disabled')) {
        state.selectedOperatorId = 'all';
      }
      renderTabs();
      renderJobOperatorOptions();
      renderOperatorsTable();
    } catch (error) {
      state.operators = [];
      state.selectedOperatorId = 'all';
      renderTabs();
      renderJobOperatorOptions();
      renderOperatorsTable(error.status === 404 || error.status === 401 || error.status === 403
        ? 'Interfaz preparada. Falta habilitar el registro seguro de operarios.'
        : `No se pudieron cargar los operarios: ${error.message}`);
    }
  }

  function selectOperator(id) {
    state.selectedOperatorId = id || 'all';
    renderTabs();
    renderJobOperatorOptions();
    if (els.reload) els.reload.click();
  }

  function showOperatorsView() {
    els.navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.view === 'operators'));
    [els.agendaPanel, els.clockPanel, els.photosPanel].forEach((panel) => {
      if (!panel) return;
      panel.hidden = true;
      panel.classList.remove('is-active');
    });
    els.operatorsPanel.hidden = false;
    els.operatorsPanel.classList.add('is-active');
    if (els.viewEyebrow) els.viewEyebrow.textContent = 'EQUIPO Y ACCESOS';
    if (els.viewTitle) els.viewTitle.textContent = 'Operarios';
  }

  function hideOperatorsViewFor(view) {
    if (view === 'operators') return;
    els.operatorsPanel.hidden = true;
    els.operatorsPanel.classList.remove('is-active');
  }

  function resetOperatorForm() {
    state.editingOperatorId = null;
    els.operatorForm.reset();
    els.operatorFormStatus.className = 'operator-form-status';
    els.operatorFormStatus.textContent = '';
    const nameInput = els.operatorForm.elements.namedItem('name');
    if (nameInput) nameInput.disabled = false;
  }

  function openNewOperator() {
    resetOperatorForm();
    els.operatorDialogTitle.textContent = 'Nuevo operario';
    els.operatorDialog.showModal();
  }

  function openPasswordReset(id) {
    const operator = state.operators.find((item) => item.id === id);
    if (!operator) return;
    resetOperatorForm();
    state.editingOperatorId = operator.id;
    els.operatorDialogTitle.textContent = `Contraseña · ${operator.name}`;
    const nameInput = els.operatorForm.elements.namedItem('name');
    if (nameInput) {
      nameInput.value = operator.name;
      nameInput.disabled = true;
    }
    els.operatorDialog.showModal();
  }

  async function saveOperator(event) {
    event.preventDefault();
    const formData = new FormData(els.operatorForm);
    const name = String(formData.get('name') || '').trim();
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');

    els.operatorFormStatus.className = 'operator-form-status';
    if (!state.editingOperatorId && name.length < 2) {
      els.operatorFormStatus.classList.add('is-error');
      els.operatorFormStatus.textContent = 'Introduce el nombre del operario.';
      return;
    }
    if (password.length < 8) {
      els.operatorFormStatus.classList.add('is-error');
      els.operatorFormStatus.textContent = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }
    if (password !== confirmPassword) {
      els.operatorFormStatus.classList.add('is-error');
      els.operatorFormStatus.textContent = 'Las contraseñas no coinciden.';
      return;
    }

    const submit = els.operatorForm.querySelector('[type="submit"]');
    submit.disabled = true;
    els.operatorFormStatus.textContent = 'Guardando acceso…';
    try {
      if (state.editingOperatorId) {
        await api(`/operators/${encodeURIComponent(state.editingOperatorId)}/password`, {
          method: 'PUT',
          body: JSON.stringify({ password }),
        });
      } else {
        await api('/operators', {
          method: 'POST',
          body: JSON.stringify({ name, password }),
        });
      }
      els.operatorFormStatus.classList.add('is-ok');
      els.operatorFormStatus.textContent = state.editingOperatorId ? 'Contraseña actualizada.' : 'Operario creado.';
      await loadOperators();
      window.setTimeout(() => els.operatorDialog.close(), 400);
    } catch (error) {
      els.operatorFormStatus.classList.add('is-error');
      if (error.status === 404 || error.status === 401 || error.status === 403) {
        els.operatorFormStatus.textContent = 'Falta habilitar el endpoint seguro de operarios. No se ha guardado ninguna contraseña en el navegador.';
      } else {
        els.operatorFormStatus.textContent = `No se pudo guardar: ${error.message}`;
      }
    } finally {
      submit.disabled = false;
    }
  }

  async function toggleStatus(id) {
    const operator = state.operators.find((item) => item.id === id);
    if (!operator) return;
    const nextStatus = operator.status === 'active' ? 'disabled' : 'active';
    try {
      await api(`/operators/${encodeURIComponent(id)}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadOperators();
      if (state.selectedOperatorId === id && nextStatus === 'disabled') selectOperator('all');
    } catch (error) {
      renderOperatorsTable(`No se pudo cambiar el estado: ${error.message}`);
    }
  }

  function bind() {
    installAgendaFetchFilter();

    if (els.manageButton) els.manageButton.addEventListener('click', showOperatorsView);
    if (els.newOperatorButton) els.newOperatorButton.addEventListener('click', openNewOperator);
    if (els.closeOperatorDialog) els.closeOperatorDialog.addEventListener('click', () => els.operatorDialog.close());
    if (els.cancelOperatorDialog) els.cancelOperatorDialog.addEventListener('click', () => els.operatorDialog.close());
    els.operatorForm.addEventListener('submit', saveOperator);

    els.navItems.forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view;
        if (view === 'operators') showOperatorsView();
        else hideOperatorsViewFor(view);
      });
    });

    if (els.jobDialog && els.jobOperatorSelect) {
      const observer = new MutationObserver(() => {
        if (els.jobDialog.open && state.selectedOperatorId !== 'all' && !els.jobOperatorSelect.value) {
          els.jobOperatorSelect.value = state.selectedOperatorId;
        }
      });
      observer.observe(els.jobDialog, { attributes: true, attributeFilter: ['open'] });
    }
  }

  bind();
  renderTabs();
  renderOperatorsTable('Cargando operarios…');
  loadOperators();
})();
