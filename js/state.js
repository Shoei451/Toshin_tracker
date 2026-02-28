// ── Utilities ────────────────────────────────────────────────
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
export const uid = () => crypto.randomUUID();
export const escapeHtml = s => (s || '').replace(/[&<>"']/g,
  m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

export function formatDate(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

export function formatYearMonth(d) {
  const dt = (d instanceof Date) ? d : new Date(d || Date.now());
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
}

export function parseYearMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m - 1 }; // month is 0-indexed
}

export function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr);
  return Math.ceil((target - today) / 86400000);
}

// ── Toast ─────────────────────────────────────────────────────
export function showToast(msg, type = '') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast${type ? ' ' + type : ''}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Global app state ─────────────────────────────────────────
export const state = {
  user: null,
  courses: [],        // toshin_courses
  units: [],          // toshin_units
  goals: [],          // toshin_monthly_goals
  masters: [],        // toshin_masters
  stages: [],         // toshin_master_stages
  progress: [],       // toshin_master_progress
  exams: [],          // calendar_app の東進模試イベント
  currentMonth: formatYearMonth(new Date()),
};
