'use strict';

const STORAGE_KEY = 'zharam.products';
const NOTIFIED_KEY = 'zharam.notified';
const DAY = 24 * 60 * 60 * 1000;

const $ = (id) => document.getElementById(id);
let products = load();

// ---------- Сақтау ----------
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

// ---------- Күн есептеу ----------
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysLeft(expiry) {
  const [y, m, d] = expiry.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - startOfToday()) / DAY);
}
function status(p) {
  const left = daysLeft(p.expiry);
  if (left < 0) return 'expired';
  if (left === 0) return 'today';
  if (left <= (Number(p.remind) || 0)) return 'soon';
  return 'ok';
}
function label(p) {
  const left = daysLeft(p.expiry);
  if (left < 0) return `Мерзімі ${-left} күн бұрын өтті`;
  if (left === 0) return 'Бүгін бітеді!';
  if (left === 1) return 'Ертең бітеді';
  return `${left} күн қалды`;
}
function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ---------- Көрсету ----------
function render() {
  const q = $('search').value.trim().toLowerCase();
  const f = $('filter').value;

  const sorted = [...products].sort((a, b) => a.expiry.localeCompare(b.expiry));
  const visible = sorted.filter((p) => {
    const s = status(p);
    const group = s === 'today' ? 'soon' : s;
    if (f !== 'all' && group !== f) return false;
    if (q && !(`${p.name} ${p.category} ${p.note || ''}`).toLowerCase().includes(q)) return false;
    return true;
  });

  $('list').innerHTML = visible.map((p) => `
    <li class="item ${status(p)}">
      <div class="info">
        <div class="name">${escapeHtml(p.name)}${p.qty > 1 ? ` × ${p.qty}` : ''}</div>
        <div class="meta">${escapeHtml(p.category)} · ${formatDate(p.expiry)}${p.note ? ' · ' + escapeHtml(p.note) : ''}</div>
      </div>
      <span class="badge">${label(p)}</span>
      <div class="actions">
        <button title="Өзгерту" data-edit="${p.id}">✏️</button>
        <button title="Жою" data-del="${p.id}">🗑️</button>
      </div>
    </li>`).join('');

  $('empty').hidden = visible.length > 0;
  $('empty').textContent = products.length ? 'Сәйкес тауар табылмады.' : 'Әзірге тауар жоқ. Жоғарыдан қосыңыз.';

  const counts = { expired: 0, soon: 0, ok: 0 };
  products.forEach((p) => { const s = status(p); counts[s === 'today' ? 'soon' : s]++; });
  $('stats').innerHTML = products.length ? `
    <span class="stat expired">Мерзімі өткен: ${counts.expired}</span>
    <span class="stat soon">Жақында бітеді: ${counts.soon}</span>
    <span class="stat ok">Жарамды: ${counts.ok}</span>` : '';

  renderAlerts();
}

function renderAlerts() {
  const urgent = products
    .filter((p) => status(p) !== 'ok')
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
  const box = $('alerts');
  if (!urgent.length) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<h2>⚠️ Назар аударыңыз (${urgent.length})</h2><ul>` +
    urgent.map((p) => `<li><b>${escapeHtml(p.name)}</b> — ${label(p)}</li>`).join('') +
    '</ul>';
}

// ---------- Форма ----------
function resetForm() {
  $('product-form').reset();
  $('edit-id').value = '';
  $('qty').value = 1;
  $('remind').value = 3;
  $('form-title').textContent = 'Тауар қосу';
  $('submit-btn').textContent = 'Қосу';
  $('cancel-edit').hidden = true;
}

$('product-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    name: $('name').value.trim(),
    expiry: $('expiry').value,
    qty: Math.max(1, Number($('qty').value) || 1),
    category: $('category').value,
    remind: Math.max(0, Number($('remind').value) || 0),
    note: $('note').value.trim(),
  };
  if (!data.name || !data.expiry) return;

  const id = $('edit-id').value;
  if (id) {
    const i = products.findIndex((p) => p.id === id);
    if (i >= 0) products[i] = { ...products[i], ...data };
  } else {
    products.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data });
  }
  save();
  resetForm();
  render();
  checkAndNotify();
});

$('cancel-edit').addEventListener('click', resetForm);

$('list').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.del) {
    const p = products.find((x) => x.id === btn.dataset.del);
    if (p && confirm(`"${p.name}" жойылсын ба?`)) {
      products = products.filter((x) => x.id !== p.id);
      save();
      render();
    }
  } else if (btn.dataset.edit) {
    const p = products.find((x) => x.id === btn.dataset.edit);
    if (!p) return;
    $('edit-id').value = p.id;
    $('name').value = p.name;
    $('expiry').value = p.expiry;
    $('qty').value = p.qty;
    $('category').value = p.category;
    $('remind').value = p.remind;
    $('note').value = p.note || '';
    $('form-title').textContent = 'Тауарды өзгерту';
    $('submit-btn').textContent = 'Сақтау';
    $('cancel-edit').hidden = false;
    $('name').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

$('search').addEventListener('input', render);
$('filter').addEventListener('change', render);

// ---------- Ескертулер ----------
function updateNotifyStatus() {
  const el = $('notify-status');
  if (!('Notification' in window)) {
    el.textContent = 'Бұл браузер хабарландыруларды қолдамайды — ескертулер беттің жоғарғы жағында көрсетіледі.';
    $('notify-btn').hidden = true;
  } else if (Notification.permission === 'granted') {
    el.textContent = '🔔 Ескертулер қосулы. Қосымшаны ашқанда және ол ашық тұрғанда әр сағат сайын тексеріледі.';
    $('notify-btn').hidden = true;
  } else if (Notification.permission === 'denied') {
    el.textContent = 'Хабарландыруларға тыйым салынған. Браузер баптауларынан рұқсат беріңіз.';
  } else {
    el.textContent = '';
  }
}

$('notify-btn').addEventListener('click', async () => {
  if (!('Notification' in window)) return;
  await Notification.requestPermission();
  updateNotifyStatus();
  checkAndNotify(true);
});

// Бір тауар туралы күніне бір рет қана хабарлайды.
function checkAndNotify(force = false) {
  const urgent = products.filter((p) => status(p) !== 'ok');
  if (!urgent.length || !('Notification' in window) || Notification.permission !== 'granted') return;

  const today = new Date().toDateString();
  let notified = {};
  try { notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY)) || {}; } catch { /* бос */ }
  if (notified.date !== today) notified = { date: today, ids: [] };

  const fresh = force ? urgent : urgent.filter((p) => !notified.ids.includes(p.id));
  if (!fresh.length) return;

  const body = fresh.slice(0, 5).map((p) => `${p.name}: ${label(p)}`).join('\n') +
    (fresh.length > 5 ? `\n...және тағы ${fresh.length - 5}` : '');
  const title = `Жарам: ${fresh.length} тауардың мерзімін тексеріңіз`;

  const show = (reg) => reg
    ? reg.showNotification(title, { body, tag: 'zharam', icon: 'icon.svg' })
    : new Notification(title, { body, tag: 'zharam', icon: 'icon.svg' });

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(show).catch(() => show(null));
  } else {
    try { show(null); } catch { /* кейбір мобильді браузерлер тек SW арқылы көрсетеді */ }
  }

  notified.ids = [...new Set([...notified.ids, ...fresh.map((p) => p.id)])];
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified));
}

// ---------- Сақтық көшірме ----------
$('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `zharam-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data) || !data.every((p) => p && p.id && p.name && /^\d{4}-\d{2}-\d{2}$/.test(p.expiry))) {
      throw new Error('format');
    }
    if (confirm(`${data.length} тауар жүктелсін бе? Қазіргі тізім ауыстырылады.`)) {
      products = data;
      save();
      render();
    }
  } catch {
    alert('Файлды оқу мүмкін болмады. Дұрыс JSON көшірмесін таңдаңыз.');
  }
  e.target.value = '';
});

// ---------- Іске қосу ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
updateNotifyStatus();
checkAndNotify();

// Ашық тұрғанда: әр сағат сайын тексеру және түн ауғанда тізімді жаңарту.
setInterval(() => { render(); checkAndNotify(); }, 60 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { render(); checkAndNotify(); }
});
