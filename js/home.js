import { state, formatYearMonth, daysUntil, escapeHtml, showToast } from './state.js';
import { fetchAll, addCourse, deleteCourse } from './cloud.js';
import { initAuth, wireAuthForm, onLogin } from './auth.js';

// ── Init ─────────────────────────────────────────────────────
async function init() {
  wireAuthForm();
  onLogin(async () => {
    showLoading(true);
    try {
      await fetchAll();
      renderAll();
    } catch (e) {
      showToast('データの読み込みに失敗しました', 'error');
      console.error(e);
    } finally {
      showLoading(false);
    }
  });
  await initAuth();
}

function showLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !on);
  document.getElementById('home-content').classList.toggle('hidden', on);
}

// ── Render all ───────────────────────────────────────────────
function renderAll() {
  renderKPI();
  renderCourseProgress();
  renderMonthlyGoals();
  renderUpcomingExams();
  renderMonthSelector();
}

// ── KPI ──────────────────────────────────────────────────────
function renderKPI() {
  const total     = state.units.length;
  const completed = state.units.filter(u => u.is_completed).length;
  const pct       = total ? Math.round((completed / total) * 100) : 0;

  const ym = state.currentMonth;
  const scheduledThisMonth = state.units.filter(u => u.scheduled_date?.startsWith(ym)).length;

  const nextMonth = (() => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m, 1); // m is already 1-indexed so this gives next month
    return formatYearMonth(d);
  })();
  const scheduledNextMonth = state.units.filter(u => u.scheduled_date?.startsWith(nextMonth)).length;

  document.getElementById('kpi-total-pct').textContent   = pct;
  document.getElementById('kpi-completed').textContent   = completed;
  document.getElementById('kpi-total-units').textContent = total;
  document.getElementById('kpi-this-month').textContent  = scheduledThisMonth;
  document.getElementById('kpi-next-month').textContent  = scheduledNextMonth;
  document.getElementById('kpi-courses').textContent     = state.courses.length;

  // overall progress bar
  const bar = document.getElementById('overall-progress-fill');
  if (bar) {
    bar.style.width = pct + '%';
    bar.className = 'progress-fill' + (pct === 100 ? ' done' : pct < 30 ? ' warn' : '');
  }
  const pctLabel = document.getElementById('overall-pct-label');
  if (pctLabel) pctLabel.textContent = pct + '%';
}

// ── Course progress cards ─────────────────────────────────────
function renderCourseProgress() {
  const container = document.getElementById('course-progress-list');
  if (!container) return;

  if (!state.courses.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📚</div><p>講座がまだ登録されていません</p></div>`;
    return;
  }

  const ym = state.currentMonth;
  const goal = (courseId) => {
    const g = state.goals.find(g => g.course_id === courseId && g.year_month === ym);
    return g?.goal_units ?? 0;
  };

  container.innerHTML = state.courses.map(course => {
    const units     = state.units.filter(u => u.course_id === course.id);
    const done      = units.filter(u => u.is_completed).length;
    const total     = course.total_units;
    const pct       = total ? Math.round((done / total) * 100) : 0;
    const g         = goal(course.id);
    const doneThisMonth = units.filter(u => u.is_completed && u.completed_at?.startsWith(ym)).length;
    const goalPct   = g ? Math.min(100, Math.round((doneThisMonth / g) * 100)) : null;

    return `
      <div class="course-card">
        <div class="course-card-header">
          <div>
            <div class="course-name">${escapeHtml(course.name)}</div>
            <span class="course-subject">${escapeHtml(course.subject)}</span>
          </div>
          <a href="courses.html" class="btn btn-ghost" style="font-size:12px;padding:6px 10px;">詳細 →</a>
        </div>
        <div class="course-progress-label">
          <span class="count">${done} / ${total} コマ完了</span>
          <span class="pct">${pct}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill${pct===100?' done':pct<30?' warn':''}" style="width:${pct}%"></div>
        </div>
        ${g ? `
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:12px;color:var(--ink-3)">${ym.replace('-','年')}月の目標</span>
            <span style="font-size:12px;font-weight:600;color:var(--ink-2)">${doneThisMonth} / ${g} コマ</span>
          </div>
          <div class="progress-bar" style="height:5px;">
            <div class="progress-fill${goalPct===100?' done':''}" style="width:${goalPct}%"></div>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ── Monthly goals summary ─────────────────────────────────────
function renderMonthlyGoals() {
  const container = document.getElementById('monthly-goals-summary');
  if (!container) return;

  const ym = state.currentMonth;
  const rows = state.courses.map(course => {
    const g = state.goals.find(x => x.course_id === course.id && x.year_month === ym);
    const goalUnits = g?.goal_units ?? 0;
    const units = state.units.filter(u => u.course_id === course.id);
    const doneThisMonth = units.filter(u => u.is_completed && u.completed_at?.startsWith(ym)).length;
    return { course, goalUnits, doneThisMonth };
  }).filter(r => r.goalUnits > 0);

  if (!rows.length) {
    container.innerHTML = `<p style="font-size:13px;color:var(--ink-3)">今月の目標はまだ設定されていません。<a href="courses.html" style="color:var(--green)">講座ページ</a>で設定できます。</p>`;
    return;
  }

  container.innerHTML = rows.map(({ course, goalUnits, doneThisMonth }) => {
    const pct = Math.min(100, Math.round((doneThisMonth / goalUnits) * 100));
    const remaining = Math.max(0, goalUnits - doneThisMonth);
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--ink);margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(course.name)}</div>
          <div class="progress-bar" style="height:6px;"><div class="progress-fill${pct===100?' done':''}" style="width:${pct}%"></div></div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:16px;font-weight:700;color:var(--ink);">${doneThisMonth}<span style="font-size:12px;color:var(--ink-3);font-weight:400;"> / ${goalUnits}</span></div>
          ${remaining > 0 ? `<div style="font-size:11px;color:var(--ink-3);">あと${remaining}コマ</div>` : `<div style="font-size:11px;color:var(--green-dark);font-weight:600;">✓ 達成</div>`}
        </div>
      </div>
    `;
  }).join('');
}

// ── Upcoming exams ────────────────────────────────────────────
function renderUpcomingExams() {
  const container = document.getElementById('upcoming-exams');
  if (!container) return;

  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = state.exams
    .filter(e => new Date(e.date) >= today)
    .slice(0, 5);

  if (!upcoming.length) {
    container.innerHTML = `<p style="font-size:13px;color:var(--ink-3);">直近の東進模試はありません。</p>`;
    return;
  }

  container.innerHTML = upcoming.map(e => {
    const days = daysUntil(e.date);
    const daysLabel = days === 0 ? '今日' : days === 1 ? '明日' : `${days}日後`;
    return `
      <div class="exam-item">
        <div class="exam-date">${e.date}</div>
        <div class="exam-title">${escapeHtml(e.title)}</div>
        <div class="exam-badge">${daysLabel}</div>
      </div>
    `;
  }).join('');
}

// ── Month selector ────────────────────────────────────────────
function renderMonthSelector() {
  const sel = document.getElementById('month-select');
  if (!sel) return;
  sel.value = state.currentMonth;
}

// ── Add course modal ──────────────────────────────────────────
function openAddCourseModal() {
  document.getElementById('add-course-modal').showModal();
  document.getElementById('course-name-input').focus();
}

document.addEventListener('DOMContentLoaded', () => {
  // Month selector
  const sel = document.getElementById('month-select');
  if (sel) {
    // Populate options (current month ±6)
    const now = new Date();
    for (let i = -2; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = formatYearMonth(d);
      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = `${d.getFullYear()}年${d.getMonth()+1}月`;
      if (ym === state.currentMonth) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      state.currentMonth = sel.value;
      renderCourseProgress();
      renderMonthlyGoals();
    });
  }

  // Add course button
  document.getElementById('add-course-btn')?.addEventListener('click', openAddCourseModal);

  // Add course form submit
  document.getElementById('add-course-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name        = document.getElementById('course-name-input').value.trim();
    const subject     = document.getElementById('course-subject-input').value.trim();
    const total_units = Number(document.getElementById('course-units-input').value);
    if (!name || !subject || !total_units) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await addCourse({ name, subject, total_units });
      document.getElementById('add-course-modal').close();
      e.target.reset();
      renderAll();
      showToast('講座を追加しました', 'success');
    } catch (err) {
      showToast('追加に失敗しました: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Close modal buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('dialog')?.close());
  });
});

// Start
init();
