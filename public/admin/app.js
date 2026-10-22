(() => {
  const STORAGE_KEYS = {
    access: 'swh_admin_access',
    refresh: 'swh_admin_refresh',
    user: 'swh_admin_user',
  };

  const els = {
    loginView: document.getElementById('login-view'),
    appView: document.getElementById('app-view'),
    loginForm: document.getElementById('login-form'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    loginError: document.getElementById('login-error'),
    sessionUser: document.getElementById('session-user'),
    btnLogout: document.getElementById('btn-logout'),
    tabs: document.querySelectorAll('.tab'),
    panelUploads: document.getElementById('panel-uploads'),
    panelThemes: document.getElementById('panel-themes'),
    uploadsGrid: document.getElementById('uploads-grid'),
    uploadsEmpty: document.getElementById('uploads-empty'),
    uploadsStatus: document.getElementById('uploads-status'),
    includeExpired: document.getElementById('include-expired'),
    btnRefreshUploads: document.getElementById('btn-refresh-uploads'),
    uploadFile: document.getElementById('upload-file'),
    currentTheme: document.getElementById('current-theme'),
    themesBody: document.getElementById('themes-body'),
    themesEmpty: document.getElementById('themes-empty'),
    btnRefreshThemes: document.getElementById('btn-refresh-themes'),
    themeForm: document.getElementById('theme-form'),
    themeFormTitle: document.getElementById('theme-form-title'),
    themeId: document.getElementById('theme-id'),
    themePhase: document.getElementById('theme-phase'),
    themeStart: document.getElementById('theme-start'),
    themeEnd: document.getElementById('theme-end'),
    themeSubmit: document.getElementById('theme-submit'),
    themeCancel: document.getElementById('theme-cancel'),
    themeError: document.getElementById('theme-error'),
    toast: document.getElementById('toast'),
  };

  let toastTimer = null;
  let countdownTimer = null;

  function getTokens() {
    return {
      accessToken: localStorage.getItem(STORAGE_KEYS.access) || '',
      refreshToken: localStorage.getItem(STORAGE_KEYS.refresh) || '',
      user: localStorage.getItem(STORAGE_KEYS.user) || '',
    };
  }

  function setSession({ accessToken, refreshToken, username }) {
    localStorage.setItem(STORAGE_KEYS.access, accessToken || '');
    localStorage.setItem(STORAGE_KEYS.refresh, refreshToken || '');
    if (username !== undefined) {
      localStorage.setItem(STORAGE_KEYS.user, username || '');
    }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.access);
    localStorage.removeItem(STORAGE_KEYS.refresh);
    localStorage.removeItem(STORAGE_KEYS.user);
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2800);
  }

  function showLogin() {
    els.loginView.classList.remove('hidden');
    els.appView.classList.add('hidden');
    if (countdownTimer) clearInterval(countdownTimer);
  }

  function showApp() {
    els.loginView.classList.add('hidden');
    els.appView.classList.remove('hidden');
    els.sessionUser.textContent = getTokens().user || 'admin';
  }

  async function api(path, options = {}, retry = true) {
    const { accessToken, refreshToken } = getTokens();
    const headers = new Headers(options.headers || {});
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    if (options.json) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(path, {
      ...options,
      headers,
      body: options.json ? JSON.stringify(options.json) : options.body,
    });

    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { success: false, message: text || 'Invalid response' };
    }

    if (res.status === 401 && data?.code === 'TOKEN_EXPIRED' && retry && refreshToken) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return api(path, options, false);
    }

    if (res.status === 401 && data?.code !== 'TOKEN_EXPIRED') {
      clearSession();
      showLogin();
    }

    return { res, data };
  }

  async function refreshAccessToken() {
    const { refreshToken } = getTokens();
    if (!refreshToken) return false;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        clearSession();
        showLogin();
        showToast('登入已過期，請重新登入');
        return false;
      }
      setSession({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
      });
      return true;
    } catch {
      return false;
    }
  }

  function formatRemaining(ms) {
    if (ms <= 0) return '已過期';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  async function loadUploads() {
    const includeExpired = els.includeExpired.checked ? '1' : '0';
    els.uploadsStatus.hidden = false;
    els.uploadsStatus.textContent = '載入中…';

    const { res, data } = await api(`/api/upload?includeExpired=${includeExpired}`);
    if (!res.ok || !data.success) {
      els.uploadsStatus.textContent = data?.message || '無法載入圖片';
      return;
    }

    const items = data.data || [];
    els.uploadsStatus.hidden = true;
    els.uploadsEmpty.classList.toggle('hidden', items.length > 0);
    els.uploadsGrid.innerHTML = items
      .map((item) => {
        const badgeClass = item.expired ? 'danger' : item.remainingMs < 15 * 60 * 1000 ? 'warn' : '';
        const badgeText = item.expired ? 'expired' : formatRemaining(item.remainingMs);
        const user = item.user?.username || '—';
        return `
          <article class="upload-card ${item.expired ? 'expired' : ''}" data-id="${escapeHtml(item.id)}">
            <div class="upload-media">
              <img src="${escapeHtml(item.imageUrl)}" alt="upload" loading="lazy" />
              <img src="${escapeHtml(item.qrcodeUrl)}" alt="qrcode" loading="lazy" />
            </div>
            <div class="upload-body">
              <div class="meta">
                <span>@${escapeHtml(user)}</span>
                <span class="badge ${badgeClass}" data-remaining="${item.remainingMs}" data-expired="${item.expired}">${badgeText}</span>
              </div>
              <div class="links">
                <a href="${escapeHtml(item.imageUrl)}" target="_blank" rel="noopener">image</a>
                <a href="${escapeHtml(item.qrcodeUrl)}" target="_blank" rel="noopener">qrcode</a>
              </div>
              <div class="upload-actions">
                <button type="button" class="btn danger" data-action="delete">刪除</button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    startCountdown();
  }

  function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    const tick = () => {
      document.querySelectorAll('[data-remaining]').forEach((el) => {
        if (el.dataset.expired === 'true') {
          el.textContent = 'expired';
          el.classList.add('danger');
          return;
        }
        let ms = Number(el.dataset.remaining || 0) - 1000;
        if (ms < 0) ms = 0;
        el.dataset.remaining = String(ms);
        el.textContent = formatRemaining(ms);
        el.classList.toggle('warn', ms > 0 && ms < 15 * 60 * 1000);
        el.classList.toggle('danger', ms <= 0);
        if (ms <= 0) el.dataset.expired = 'true';
      });
    };
    countdownTimer = setInterval(tick, 1000);
  }

  async function deleteUpload(id) {
    if (!confirm('確定刪除此圖片與 QR Code？')) return;
    const { res, data } = await api(`/api/upload/${id}`, { method: 'DELETE' });
    if (!res.ok || !data.success) {
      showToast(data?.message || '刪除失敗');
      return;
    }
    showToast('已刪除');
    loadUploads();
  }

  async function uploadImage(file) {
    const body = new FormData();
    body.append('image', file);
    const { res, data } = await api('/api/upload', { method: 'POST', body });
    if (!res.ok || !data.success) {
      showToast(data?.message || '上傳失敗');
      return;
    }
    showToast('上傳成功');
    loadUploads();
  }

  async function loadThemes() {
    const [current, list] = await Promise.all([
      api('/api/theme/current'),
      api('/api/theme'),
    ]);

    if (current.res.ok && current.data.success) {
      const t = current.data.data;
      els.currentTheme.innerHTML = `
        <div>今天（${escapeHtml(t.queried_date)}）屬於</div>
        <strong>Phase ${escapeHtml(t.phase)}</strong>
        <div class="muted">${escapeHtml(t.start_date)} → ${escapeHtml(t.end_date)}</div>
      `;
    } else {
      els.currentTheme.innerHTML = `<div class="muted">${escapeHtml(current.data?.message || '今日沒有對應 phase')}</div>`;
    }

    if (!list.res.ok || !list.data.success) {
      showToast(list.data?.message || '無法載入 themes');
      return;
    }

    const items = list.data.data || [];
    const today = new Date().toISOString().slice(0, 10);
    els.themesEmpty.classList.toggle('hidden', items.length > 0);
    els.themesBody.innerHTML = items
      .map((t) => {
        const active = t.start_date <= today && today <= t.end_date;
        return `
          <tr class="${active ? 'active-row' : ''}" data-id="${escapeHtml(t.id)}">
            <td><span class="phase-pill">${escapeHtml(t.phase)}</span></td>
            <td>${escapeHtml(t.start_date)}</td>
            <td>${escapeHtml(t.end_date)}</td>
            <td class="actions">
              <button type="button" class="btn" data-action="edit"
                data-phase="${escapeHtml(t.phase)}"
                data-start="${escapeHtml(t.start_date)}"
                data-end="${escapeHtml(t.end_date)}">編輯</button>
              <button type="button" class="btn danger" data-action="delete">刪除</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function resetThemeForm() {
    els.themeId.value = '';
    els.themePhase.value = '1';
    els.themeStart.value = '';
    els.themeEnd.value = '';
    els.themeFormTitle.textContent = '新增 Theme';
    els.themeSubmit.textContent = '儲存';
    els.themeCancel.hidden = true;
    els.themeError.hidden = true;
  }

  function editTheme({ id, phase, start, end }) {
    els.themeId.value = id;
    els.themePhase.value = String(phase);
    els.themeStart.value = start;
    els.themeEnd.value = end;
    els.themeFormTitle.textContent = '編輯 Theme';
    els.themeSubmit.textContent = '更新';
    els.themeCancel.hidden = false;
    els.themeError.hidden = true;
  }

  async function saveTheme(event) {
    event.preventDefault();
    els.themeError.hidden = true;

    const payload = {
      phase: Number(els.themePhase.value),
      start_date: els.themeStart.value,
      end_date: els.themeEnd.value,
    };
    const id = els.themeId.value;
    const { res, data } = await api(id ? `/api/theme/${id}` : '/api/theme', {
      method: id ? 'PUT' : 'POST',
      json: payload,
    });

    if (!res.ok || !data.success) {
      els.themeError.textContent = data?.message || '儲存失敗';
      els.themeError.hidden = false;
      return;
    }

    showToast(id ? 'Theme 已更新' : 'Theme 已新增');
    resetThemeForm();
    loadThemes();
  }

  async function deleteTheme(id) {
    if (!confirm('確定刪除此 theme？')) return;
    const { res, data } = await api(`/api/theme/${id}`, { method: 'DELETE' });
    if (!res.ok || !data.success) {
      showToast(data?.message || '刪除失敗');
      return;
    }
    showToast('Theme 已刪除');
    if (els.themeId.value === id) resetThemeForm();
    loadThemes();
  }

  function switchTab(name) {
    els.tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    els.panelUploads.classList.toggle('hidden', name !== 'uploads');
    els.panelThemes.classList.toggle('hidden', name !== 'themes');
    if (name === 'uploads') loadUploads();
    if (name === 'themes') loadThemes();
  }

  // Events
  els.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.loginError.hidden = true;
    const username = els.loginUsername.value.trim();
    const password = els.loginPassword.value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        els.loginError.textContent = data?.message || '登入失敗';
        els.loginError.hidden = false;
        return;
      }
      setSession({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
        username: data.data.user?.username || username,
      });
      showApp();
      switchTab('uploads');
    } catch {
      els.loginError.textContent = '無法連線伺服器';
      els.loginError.hidden = false;
    }
  });

  els.btnLogout.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    clearSession();
    showLogin();
  });

  els.tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  els.btnRefreshUploads.addEventListener('click', loadUploads);
  els.includeExpired.addEventListener('change', loadUploads);
  els.btnRefreshThemes.addEventListener('click', loadThemes);
  els.themeForm.addEventListener('submit', saveTheme);
  els.themeCancel.addEventListener('click', resetThemeForm);

  els.uploadFile.addEventListener('change', async () => {
    const file = els.uploadFile.files?.[0];
    els.uploadFile.value = '';
    if (file) await uploadImage(file);
  });

  els.uploadsGrid.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="delete"]');
    if (!btn) return;
    const card = btn.closest('[data-id]');
    if (card) deleteUpload(card.dataset.id);
  });

  els.themesBody.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const row = btn.closest('[data-id]');
    if (!row) return;
    if (btn.dataset.action === 'delete') {
      deleteTheme(row.dataset.id);
      return;
    }
    if (btn.dataset.action === 'edit') {
      editTheme({
        id: row.dataset.id,
        phase: btn.dataset.phase,
        start: btn.dataset.start,
        end: btn.dataset.end,
      });
    }
  });

  // Boot
  if (getTokens().accessToken) {
    showApp();
    switchTab('uploads');
  } else {
    showLogin();
  }
})();
