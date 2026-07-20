import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import UlanziApi from './plugin-common-node/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_UUID = 'com.narlei.appleshortcuts.plugin';
const ICON_SCRIPT = join(__dirname, 'scripts', 'get-shortcut-icon.applescript');
const LIST_TIMEOUT_MS = 10000;
const ICON_TIMEOUT_MS = 8000;
// Shortcuts can be slow (network calls, dialogs, Focus/HomeKit waits) — give
// them plenty of room instead of killing them mid-run.
const RUN_TIMEOUT_MS = 5 * 60 * 1000;

// `shortcuts list --show-identifiers` prints one "Name (UUID)" per line.
const LIST_LINE_RE = /^(.*) \(([0-9A-Fa-f-]{36})\)$/;

const $UD = new UlanziApi();
const INSTANCES = new Map();
// shortcutId -> data:image/png;base64,... (or null if fetching it failed —
// cached too, so a broken lookup isn't retried on every render).
const ICON_CACHE = new Map();
const ICON_FETCHING = new Set();

function log(...args) {
  console.log('[apple-shortcuts]', ...args);
}

// `shortcuts` hangs indefinitely if its stdin is left open as a pipe (the
// default for spawn/execFile) — it seems to block waiting for stdin to close.
// Explicitly ignoring stdin avoids that; stdout/stderr are still captured.
// The same precaution is applied to osascript/sips below for consistency.
function runCommand(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => resolve({ ok: false, error: err.message }));
    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ ok: false, error: (stderr || `exit code ${code}`).trim() });
        return;
      }
      resolve({ ok: true, stdout: stdout.trim() });
    });
  });
}

function runShortcutsCli(args, timeoutMs) {
  return runCommand('shortcuts', args, timeoutMs);
}

async function listShortcuts() {
  const result = await runShortcutsCli(['list', '--show-identifiers'], LIST_TIMEOUT_MS);
  if (!result.ok) return result;
  const shortcuts = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(LIST_LINE_RE);
      return m ? { name: m[1], id: m[2] } : { name: line, id: line };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return { ok: true, shortcuts };
}

function runShortcut(id) {
  return runShortcutsCli(['run', id], RUN_TIMEOUT_MS);
}

// Fetches a shortcut's real icon (the colored rounded-square glyph shown in
// the Shortcuts app): AppleScript writes it out as TIFF, `sips` (built into
// macOS) converts that to PNG, then it's read back and base64-encoded.
async function fetchShortcutIconDataUrl(shortcutId) {
  const base = join(tmpdir(), `ulanzi-shortcut-icon-${randomBytes(6).toString('hex')}`);
  const tiffPath = `${base}.tiff`;
  const pngPath = `${base}.png`;
  try {
    const asResult = await runCommand('osascript', [ICON_SCRIPT, shortcutId, tiffPath], ICON_TIMEOUT_MS);
    if (!asResult.ok || asResult.stdout !== 'ok') return null;
    const sipsResult = await runCommand('sips', ['-s', 'format', 'png', tiffPath, '--out', pngPath], ICON_TIMEOUT_MS);
    if (!sipsResult.ok) return null;
    const buf = await readFile(pngPath);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch (e) {
    log('icon fetch failed', shortcutId, e?.message);
    return null;
  } finally {
    unlink(tiffPath).catch(() => {});
    unlink(pngPath).catch(() => {});
  }
}

// Re-renders every live instance currently configured to use `shortcutId`
// (several buttons can share the same shortcut) once its icon is cached.
function rerenderInstancesUsing(shortcutId) {
  for (const inst of INSTANCES.values()) {
    if (inst.settings?.shortcutId === shortcutId) renderInstance(inst);
  }
}

function ensureIconFetch(shortcutId) {
  if (ICON_CACHE.has(shortcutId) || ICON_FETCHING.has(shortcutId)) return;
  ICON_FETCHING.add(shortcutId);
  fetchShortcutIconDataUrl(shortcutId)
    .then((dataUrl) => {
      ICON_CACHE.set(shortcutId, dataUrl);
      rerenderInstancesUsing(shortcutId);
    })
    .finally(() => ICON_FETCHING.delete(shortcutId));
}

function renderInstance(inst) {
  if (!inst.active) return;
  const { shortcutId, shortcutName } = inst.settings || {};
  if (!shortcutId) {
    $UD.setPathIcon(inst.context, 'resources/icon.svg', '');
    return;
  }
  const cached = ICON_CACHE.get(shortcutId);
  if (cached) {
    $UD.setBaseDataIcon(inst.context, cached, '');
    return;
  }
  // Not cached (yet, or the fetch failed) — fall back to the generic icon
  // with the shortcut's name on it, and kick off a background fetch.
  $UD.setPathIcon(inst.context, 'resources/icon.svg', shortcutName || '');
  ensureIconFetch(shortcutId);
}

function ensureInstance(context, settings) {
  let inst = INSTANCES.get(context);
  if (!inst) {
    inst = { context, settings: settings || {}, active: true };
    INSTANCES.set(context, inst);
  } else if (settings) {
    inst.settings = settings;
  }
  renderInstance(inst);
  return inst;
}

$UD.connect(PLUGIN_UUID);

$UD.onConnected(() => log('connected'));

$UD.onAdd((msg) => ensureInstance(msg.context, msg.param || {}));
$UD.onParamFromApp((msg) => ensureInstance(msg.context, msg.param || {}));
$UD.onParamFromPlugin((msg) => ensureInstance(msg.context, msg.param || {}));

// The Property Inspector's setSettings() call is delivered here — without this
// listener, picking a different shortcut in the PI never reaches the running
// instance on this side.
$UD.onDidReceiveSettings((msg) => {
  ensureInstance(msg.context, msg.settings || msg.param || {});
});

$UD.onSetActive((msg) => {
  const inst = INSTANCES.get(msg.context);
  if (!inst) return;
  inst.active = !!msg.active;
  if (inst.active) renderInstance(inst);
});

$UD.onClear((msg) => {
  if (!msg.param) return;
  for (const item of msg.param) INSTANCES.delete(item.context);
});

$UD.onRun(async (msg) => {
  const inst = INSTANCES.get(msg.context) || ensureInstance(msg.context, msg.param || {});
  const { shortcutId, shortcutName } = inst.settings || {};
  if (!shortcutId) {
    $UD.toast('Pick a Shortcut in the Property Inspector first');
    $UD.showAlert(msg.context);
    return;
  }

  const label = shortcutName || shortcutId;
  log('running', label);
  const result = await runShortcut(shortcutId);
  if (!result.ok) {
    $UD.toast(`"${label}" failed: ${result.error || 'unknown error'}`.slice(0, 140));
    $UD.showAlert(msg.context);
    return;
  }
  $UD.toast(`Ran "${label}"`);
});

// The Property Inspector cannot run shell commands itself, so it asks the
// Node-side plugin (here) to enumerate installed Shortcuts on its behalf.
$UD.onSendToPlugin(async (msg) => {
  const payload = msg.payload || {};
  if (payload.type !== 'listShortcuts') return;
  // "Refresh list" is the only refresh affordance in the PI, so it also
  // drops cached icons — otherwise renaming/recoloring a shortcut in the
  // Shortcuts app would never show up without restarting the plugin.
  ICON_CACHE.clear();
  for (const inst of INSTANCES.values()) renderInstance(inst);
  const result = await listShortcuts();
  $UD.sendToPropertyInspector({ type: 'shortcuts', ...result }, msg.context);
});

$UD.onError((err) => log('socket error', err));
$UD.onClose(() => log('socket closed'));
