let settings = {};
let loaded = false;
let shortcuts = [];
// The last shortcutId this PI itself sent via setSettings — lets us recognize
// the deck echoing our own save back through didReceiveSettings and skip
// re-populating from it (an echo mid-edit would otherwise clobber the select).
let lastSent = null;

const selectEl = document.getElementById('shortcutId');
const refreshBtn = document.getElementById('refreshBtn');

function renderOptions() {
  const current = settings.shortcutId || '';
  selectEl.innerHTML = '';

  // No auto-selection — a freshly added button should do nothing until the
  // user explicitly picks a shortcut.
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = shortcuts.length ? '— Select a Shortcut —' : 'No shortcuts found';
  selectEl.appendChild(placeholder);

  // If the saved selection isn't among the detected shortcuts (e.g. it was
  // deleted or renamed), keep it visible but disabled so the button doesn't
  // silently switch to something else underneath it.
  const known = shortcuts.some((s) => s.id === current);
  if (current && !known) {
    const opt = document.createElement('option');
    opt.value = current;
    opt.textContent = `${settings.shortcutName || current} (not found)`;
    opt.disabled = true;
    selectEl.appendChild(opt);
  }

  // Already sorted alphabetically by the plugin; keep as-is.
  for (const s of shortcuts) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    selectEl.appendChild(opt);
  }

  selectEl.value = current;
}

function requestShortcuts() {
  selectEl.innerHTML = '<option value="">Loading shortcuts…</option>';
  $UD.sendToPlugin({ type: 'listShortcuts' });
}

function save() {
  if (!loaded) return;
  const id = selectEl.value;
  const shortcut = shortcuts.find((s) => s.id === id);
  settings = {
    ...settings,
    shortcutId: id,
    shortcutName: shortcut ? shortcut.name : settings.shortcutName || '',
  };
  lastSent = settings.shortcutId;
  $UD.setSettings(settings);
}

$UD.connect();

$UD.onConnected(() => {
  $UD.getSettings();
  requestShortcuts();
  // Fallback: if the deck never answers (brand-new button with no saved
  // settings), unblock saving so a user pick still persists.
  setTimeout(() => { loaded = true; }, 600);
  document.querySelector('.udpi-wrapper').classList.remove('hidden');
});

$UD.onDidReceiveSettings((msg) => {
  const p = msg && (msg.param || msg.settings);
  if (p && 'shortcutId' in p) {
    const isSelfEcho = loaded && lastSent !== null && (p.shortcutId || '') === lastSent;
    settings = p;
    loaded = true;
    if (!isSelfEcho) renderOptions();
  } else {
    loaded = true;
  }
});

$UD.onSendToPropertyInspector((msg) => {
  const payload = msg && msg.payload;
  if (!payload || payload.type !== 'shortcuts') return;
  shortcuts = Array.isArray(payload.shortcuts) ? payload.shortcuts : [];
  renderOptions();
});

selectEl.addEventListener('change', save);
refreshBtn.addEventListener('click', requestShortcuts);
