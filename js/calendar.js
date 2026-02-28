import { state, formatDate, formatYearMonth, escapeHtml, showToast, $ } from './state.js';
import { fetchAll, setUnitScheduledDate } from './cloud.js';
import { requireAuthOrRedirect, wireLogoutButton } from './auth.js';

// ── State ─────────────────────────────────────────────────────
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed

// ── Init ─────────────────────────────────────────────────────
async function init() {
  wireLogoutButton();
  const session = await requireAuthOrRedirect('index.html');
  if (!session) return;

  showLoading(true);
  try {
    await fetchAll();
    render();
  } catch (e) {
    showToast('データの読み込みに失敗しました', 'error');
    console.error(e);
  } finally {
    showLoading(false);
  }
}
function showLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !on);
  document.getElementById('calendar-content').classList.toggle('hidden', on);
}

// ── Calendar matrix (same logic as calendar_app) ──────────────
function getMonthMatrix(y, m) {
  const days = [];
  const firstDay = new Date(y, m, 1);
  let dow = firstDay.getDay();
  dow = dow === 0 ? 6 : dow - 1; // Monday-first
  for (let i = 0; i < dow; i++) days.push(null);
  const lastDate = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= lastDate; d++) days.push(new Date(y, m, d));
  return days;
}

// ── Build event index for the month ───────────────────────────
function buildEventIndex() {
  const index = new Map(); // date string → [{type, label, id, unitId}]

  // 東進受講（予定日があるユニット）
  for (const unit of state.units) {
    if (!unit.scheduled_date) continue;
    const course = state.courses.find(c => c.id === unit.course_id);
    const entry = {
      type:    'unit',
      label:   `${course?.name || '東進'} 第${unit.unit_number}コマ`,
      subject: course?.subject || '',
      unitId:  unit.id,
      done:    unit.is_completed,
    };
    if (!index.has(unit.scheduled_date)) index.set(unit.scheduled_date, []);
    index.get(unit.scheduled_date).push(entry);
  }

  // 東進模試（calendar_appからfetch済み）
  for (const exam of state.exams) {
    const entry = {
      type:  'exam',
      label: exam.title,
      id:    exam.id,
    };
    if (!index.has(exam.date)) index.set(exam.date, []);
    index.get(exam.date).push(entry);
  }

  return index;
}

// ── Render ────────────────────────────────────────────────────
function render() {
  renderHeader();
  renderCalendar();
  renderMonthSummary();
}

function renderHeader() {
  const label = `${currentYear}年${currentMonth + 1}月`;
  document.getElementById('month-label').textContent = label;
}

function renderCalendar() {
  const grid    = document.getElementById('calendar-grid');
  const todayStr = formatDate(new Date());
  const cells   = getMonthMatrix(currentYear, currentMonth);
  const index   = buildEventIndex();

  // Clear cell rows (keep day-of-week headers)
  grid.querySelectorAll('.cal-cell').forEach(el => el.remove());

  const frag = document.createDocumentFragment();

  cells.forEach(d => {
    const cell = document.createElement('div');
    cell.className = 'cal-cell';

    if (d === null) {
      cell.classList.add('empty');
      frag.appendChild(cell);
      return;
    }

    const dStr   = formatDate(d);
    const events = index.get(dStr) || [];
    const dow    = d.getDay(); // 0=Sun,6=Sat

    if (dStr === todayStr) cell.classList.add('today');
    if (dow === 0) cell.classList.add('sun');
    if (dow === 6) cell.classList.add('sat');
    if (events.length > 0) cell.classList.add('has-events');

    const dateEl = document.createElement('div');
    dateEl.className = 'cal-date';
    dateEl.textContent = d.getDate();
    cell.appendChild(dateEl);

    // Event chips (max 3 on desktop, 2 on mobile)
    const chips = document.createElement('div');
    chips.className = 'cal-chips';
    events.slice(0, 3).forEach(ev => {
      const chip = document.createElement('div');
      chip.className = `cal-chip${ev.type === 'exam' ? ' exam' : ev.done ? ' done' : ''}`;
      chip.textContent = ev.type === 'exam' ? ev.label : `第${getUnitNumber(ev.unitId)}コマ`;
      chip.title = ev.label;
      if (ev.type === 'unit') {
        chip.addEventListener('click', e => { e.stopPropagation(); openDayModal(dStr, events); });
      }
      chips.appendChild(chip);
    });
    if (events.length > 3) {
      const more = document.createElement('div');
      more.className = 'cal-more';
      more.textContent = `+${events.length - 3}`;
      chips.appendChild(more);
    }
    cell.appendChild(chips);

    cell.addEventListener('click', () => openDayModal(dStr, events));
    frag.appendChild(cell);
  });

  grid.appendChild(frag);
}

function getUnitNumber(unitId) {
  return state.units.find(u => u.id === unitId)?.unit_number ?? '?';
}

// ── Month summary (sidebar / below on mobile) ─────────────────
function renderMonthSummary() {
  const ym = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const scheduledUnits = state.units.filter(u => u.scheduled_date?.startsWith(ym));
  const doneInMonth    = state.units.filter(u => u.is_completed && u.completed_at?.startsWith(ym));
  const examsInMonth   = state.exams.filter(e => e.date.startsWith(ym));

  document.getElementById('summary-scheduled').textContent  = scheduledUnits.length;
  document.getElementById('summary-done').textContent       = doneInMonth.length;
  document.getElementById('summary-exams').textContent      = examsInMonth.length;

  // Scheduled list
  const list = document.getElementById('scheduled-list');
  if (!scheduledUnits.length && !examsInMonth.length) {
    list.innerHTML = `<div class="empty-state" style="padding:20px 0;"><p style="font-size:13px;">この月の予定はありません</p></div>`;
    return;
  }

  // Combine and sort by date
  const allEvents = [
    ...scheduledUnits.map(u => {
      const course = state.courses.find(c => c.id === u.course_id);
      return { date: u.scheduled_date, type: 'unit', label: `${course?.name || '東進'} 第${u.unit_number}コマ`, done: u.is_completed, unitId: u.id };
    }),
    ...examsInMonth.map(e => ({ date: e.date, type: 'exam', label: e.title })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  list.innerHTML = allEvents.map(ev => `
    <div class="schedule-item${ev.type === 'exam' ? ' exam' : ev.done ? ' done' : ''}">
      <div class="schedule-date">${ev.date.slice(5).replace('-', '/')}</div>
      <div class="schedule-label">${escapeHtml(ev.label)}</div>
      ${ev.done ? '<div class="schedule-badge done">完了</div>' : ''}
      ${ev.type === 'exam' ? '<div class="schedule-badge exam">模試</div>' : ''}
    </div>
  `).join('');
}

// ── Day modal ─────────────────────────────────────────────────
function openDayModal(dateStr, events) {
  const [y, m, d] = dateStr.split('-');
  document.getElementById('day-modal-title').textContent = `${y}年${parseInt(m)}月${parseInt(d)}日`;

  const body = document.getElementById('day-modal-body');
  if (!events.length) {
    body.innerHTML = `<p style="font-size:13px;color:var(--ink-3);padding:8px 0;">この日の予定はありません</p>`;
  } else {
    body.innerHTML = events.map(ev => `
      <div class="day-event-item${ev.type === 'exam' ? ' exam' : ev.done ? ' done' : ''}">
        <div class="day-event-icon">${ev.type === 'exam' ? '📝' : ev.done ? '✅' : '📖'}</div>
        <div class="day-event-label">${escapeHtml(ev.label)}</div>
        ${ev.type === 'exam' ? '<span class="badge" style="background:rgba(0,156,136,0.1);color:#009c88;">東進模試</span>' : ''}
      </div>
    `).join('');
  }

  document.getElementById('day-modal').showModal();
}

// ── Navigation ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('prev-btn').addEventListener('click', () => {
    const d = new Date(currentYear, currentMonth - 1, 1);
    currentYear = d.getFullYear(); currentMonth = d.getMonth();
    render();
  });
  document.getElementById('next-btn').addEventListener('click', () => {
    const d = new Date(currentYear, currentMonth + 1, 1);
    currentYear = d.getFullYear(); currentMonth = d.getMonth();
    render();
  });
  document.getElementById('today-btn').addEventListener('click', () => {
    currentYear = new Date().getFullYear();
    currentMonth = new Date().getMonth();
    render();
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('dialog')?.close());
  });
});

init();
