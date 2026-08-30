(() => {
  'use strict';

  const API_BASE = '/lab/api';
  const INSTALLER_ROLE = 'installer';
  const INSTALLER_SELF_EDITABLE_FIELDS = ['photo'];
  const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;

  const state = {
    operators: [],
    selectedOperatorId: 'all',
    editingOperatorId: null,
    dialogMode: 'create',
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
      phone: String(operator?.phone || operator?.telefono || '').trim(),
      role: String(operator?.role || INSTALLER_ROLE).trim() || INSTALLER_ROLE,
      status: String(operator?.status || (operator?.disabled ? 'disabled' : 'active')).toLowerCase(),
      updatedAt: String(operator?.updatedAt || operator?.passwordUpdatedAt || '').trim(),
      selfEditableFields: Array.isArray(operator?.selfEditableFields)
        ? operator.selfEditableFields.map((item) => String(item))
        : INSTALLER_SELF_EDITABLE_FIELDS,
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

  function installOperatorFetchFilter() {
    window.fetch = async (input, init) => {
      try {
        const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
        if (['/lab/api/agenda', '/lab/api/clock', '/lab/api/photos'].includes(url.pathname)) {
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

  function ensureOfficeManagedFields() {
    const fields = els.operatorForm.querySelector('.operator-form-fields');
    const nameInput = els.operatorForm.elements.namedItem('name');
    if (!fields || !nameInput) return;

    if (!els.operatorForm.elements.namedItem('username')) {
      const label = document.createElement('label');
      label.dataset.officeProfileField = 'username';
      label.innerHTML = '<span>Usuario de acceso SAT</span><input name="username" autocomplete="off" minlength="3" maxlength="32" required placeholder="ej. david">';
      nameInput.closest('label')?.insertAdjacentElement('afterend', label);
    }

    if (!els.operatorForm.elements.namedItem('phone')) {
      const usernameInput = els.operatorForm.elements.namedItem('username');
      const label = document.createElement('label');
      label.dataset.officeProfileField = 'phone';
      label.innerHTML = '<span>Teléfono</span><input name="phone" inputmode="tel" autocomplete="off" placeholder="Opcional">';
      usernameInput?.closest('label')?.insertAdjacentElement('afterend', label);
    }

    els.operatorForm.querySelectorAll('input[name="password"], input[name="confirmPassword"]').forEach((input) => {
      input.closest('label')?.setAttribute('data-password-field', 'true');
    });

    const hint = els.operatorForm.querySelector('.operator-form-hint');
    if (hint) {
      hint.textContent = 'La oficina crea el usuario y la contraseña. En la APK el operario no puede editar nombre, usuario, teléfono, rol ni contraseña: únicamente su foto de perfil.';
    }

    const securityNote = document.querySelector('.operator-security-note div');
    if (securityNote) {
      securityNote.innerHTML = '<strong>Acceso administrado por oficina.</strong> No se usa Google para identificar al operario. La secretaria asigna usuario y contraseña; el backend guarda solo un hash de la contraseña. El operario puede cambiar únicamente su foto desde SAT.';
    }

    const description = els.operatorsPanel.querySelector('.operator-management-head p:not(.section-kicker)');
    if (description) {
      description.textContent = 'La oficina crea las cuentas SAT, asigna credenciales, modifica los datos del operario y controla su acceso. El operario solo puede actualizar su foto de perfil.';
    }
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
    const header = els.operatorsPanel.querySelector('.operators-table thead tr');
    if (header) {
      header.innerHTML = '<th>Operario</th><th>Estado</th><th>Último cambio</th><th>Acceso SAT</th><th>Acciones</th>';
    }

    if (!state.operators.length) {
      els.operatorsBody.innerHTML = `<tr class="table-empty"><td colspan="5">${escapeHtml(message || 'No hay operarios creados todavía.')}</td></tr>`;
      return;
    }

    els.operatorsBody.innerHTML = state.operators.map((operator) => `
      <tr>
        <td><div class="operator-name-cell"><strong>${escapeHtml(operator.name)}</strong><span>USUARIO · ${escapeHtml(operator.username || 'sin asignar')}${operator.phone ? ` · ${escapeHtml(operator.phone)}` : ''}</span></div></td>
        <td><span class="operator-status ${operator.status === 'active' ? 'is-active' : 'is-disabled'}">${operator.status === 'active' ? 'ACTIVO' : 'DESACTIVADO'}</span></td>
        <td>${escapeHtml(operator.updatedAt || '—')}</td>
        <td><div class="operator-name-cell"><strong>INSTALADOR</strong><span>Perfil SAT: solo puede cambiar su foto</span></div></td>
        <td><div class="operator-actions">
          <button class="operator-action" type="button" data-edit-profile="${escapeHtml(operator.id)}">EDITAR DATOS</button>
          <button class="operator-action" type="button" data-reset-password="${escapeHtml(operator.id)}">NUEVA CONTRASEÑA</button>
          <button class="operator-action ${operator.status === 'active' ? 'is-danger' : ''}" type="button" data-toggle-status="${escapeHtml(operator.id)}">${operator.status === 'active' ? 'DESACTIVAR' : 'ACTIVAR'}</button>
        </div></td>
      </tr>`).join('');

    els.operatorsBody.querySelectorAll('[data-edit-profile]').forEach((button) => {
      button.addEventListener('click', () => openProfileEdit(button.dataset.editProfile));
    });
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

  function setDialogMode(mode, operator = null) {
    state.dialogMode = mode;
    state.editingOperatorId = operator?.id || null;
    els.operatorForm.reset();
    els.operatorFormStatus.className = 'operator-form-status';
    els.operatorFormStatus.textContent = '';

    const nameInput = els.operatorForm.elements.namedItem('name');
    const usernameInput = els.operatorForm.elements.namedItem('username');
    const phoneInput = els.operatorForm.elements.namedItem('phone');
    const passwordInput = els.operatorForm.elements.namedItem('password');
    const confirmPasswordInput = els.operatorForm.elements.namedItem('confirmPassword');
    const profileInputs = [nameInput, usernameInput, phoneInput].filter(Boolean);
    const passwordInputs = [passwordInput, confirmPasswordInput].filter(Boolean);

    profileInputs.forEach((input) => { input.disabled = mode === 'password'; });
    passwordInputs.forEach((input) => {
      input.disabled = mode === 'profile';
      input.required = mode !== 'profile';
      input.closest('label').hidden = mode === 'profile';
    });

    if (operator) {
      if (nameInput) nameInput.value = operator.name || '';
      if (usernameInput) usernameInput.value = operator.username || '';
      if (phoneInput) phoneInput.value = operator.phone || '';
    }

    if (mode === 'create') els.operatorDialogTitle.textContent = 'Nuevo operario';
    if (mode === 'profile') els.operatorDialogTitle.textContent = `Datos · ${operator?.name || 'Operario'}`;
    if (mode === 'password') els.operatorDialogTitle.textContent = `Contraseña · ${operator?.name || 'Operario'}`;
  }

  function openNewOperator() {
    setDialogMode('create');
    els.operatorDialog.showModal();
  }

  function openProfileEdit(id) {
    const operator = state.operators.find((item) => item.id === id);
    if (!operator) return;
    setDialogMode('profile', operator);
    els.operatorDialog.showModal();
  }

  function openPasswordReset(id) {
    const operator = state.operators.find((item) => item.id === id);
    if (!operator) return;
    setDialogMode('password', operator);
    els.operatorDialog.showModal();
  }

  function validateUsername(username) {
    return USERNAME_PATTERN.test(username);
  }

  async function saveOperator(event) {
    event.preventDefault();
    const formData = new FormData(els.operatorForm);
    const name = String(formData.get('name') || '').trim();
    const username = String(formData.get('username') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');

    els.operatorFormStatus.className = 'operator-form-status';

    if (state.dialogMode !== 'password') {
      if (name.length < 2) {
        els.operatorFormStatus.classList.add('is-error');
        els.operatorFormStatus.textContent = 'Introduce el nombre del operario.';
        return;
      }
      if (!validateUsername(username)) {
        els.operatorFormStatus.classList.add('is-error');
        els.operatorFormStatus.textContent = 'El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.';
        return;
      }
    }

    if (state.dialogMode !== 'profile') {
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
    }

    const submit = els.operatorForm.querySelector('[type="submit"]');
    submit.disabled = true;
    els.operatorFormStatus.textContent = 'Guardando acceso…';

    try {
      if (state.dialogMode === 'password') {
        await api(`/operators/${encodeURIComponent(state.editingOperatorId)}/password`, {
          method: 'PUT',
          body: JSON.stringify({ password }),
        });
      } else if (state.dialogMode === 'profile') {
        await api(`/operators/${encodeURIComponent(state.editingOperatorId)}`, {
          method: 'PUT',
          body: JSON.stringify({
            name,
            username,
            phone,
            role: INSTALLER_ROLE,
            selfEditableFields: INSTALLER_SELF_EDITABLE_FIELDS,
          }),
        });
      } else {
        await api('/operators', {
          method: 'POST',
          body: JSON.stringify({
            name,
            username,
            phone,
            password,
            role: INSTALLER_ROLE,
            selfEditableFields: INSTALLER_SELF_EDITABLE_FIELDS,
          }),
        });
      }

      els.operatorFormStatus.classList.add('is-ok');
      els.operatorFormStatus.textContent = state.dialogMode === 'password'
        ? 'Contraseña actualizada.'
        : state.dialogMode === 'profile'
          ? 'Datos actualizados desde oficina.'
          : 'Operario creado y preparado para acceder a SAT.';
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
    ensureOfficeManagedFields();
    installOperatorFetchFilter();

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