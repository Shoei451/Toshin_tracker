import { state, formatYearMonth, formatDate, escapeHtml, showToast, $ } from './state.js';
import { fetchAll, toggleUnitComplete, setUnitScheduledDate, upsertGoal, deleteCourse } from './cloud.js';
import { requireAuthOrRedirect, wireLogoutButton } from './auth.js';

// ── State ─────────────────────────────────────────────────────
let selectedCourseId = null;
let currentMonth     = formatYearMonth(new Date());

// ── Init ─────────────────────────────────────────────────────
async function init() {
  wireLogoutButton();
  const session = await requireAuthOrRedirect('index.html');
  if (!session) return;

  showLoading(true);
  try {
    await fetchAll();
    renderCourseList();
    const params = new URLSearchParams(location.search);
    const cid = params.get('course');
    if (cid && state.courses.find(c => c.id === cid)) {
      selectCourse(cid);
    } else if (state.courses.length) {
      selectCourse(state.courses[0].id);
    }
  } catch (e) {
    showToast('データの読み込みに失敗しました', 'error');
    console.error(e);
  } finally {
    showLoading(false);
  }
}
function showLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !on);
  document.getElementById('courses-content').classList.toggle('hidden', on);
}

// ── Course list (sidebar) ─────────────────────────────────────
function renderCourseList() {
  const container = document.getElementById('course-list');
  if (!container) return;

  if (!state.courses.length) {
    container.innerHTML = `<div class="empty-state" style="padding:24px 12px;"><div class="icon" style="font-size:24px;">📚</div><p style="font-size:12px;">講座がありません</p></div>`;
    return;
  }

  container.innerHTML = state.courses.map(course => {
    const units  = state.units.filter(u => u.course_id === course.id);
    const done   = units.filter(u => u.is_completed).length;
    const total  = course.total_units;
    const pct    = total ? Math.round((done / total) * 100) : 0;
    const active = course.id === selectedCourseId;

    return `
      <div class="course-list-item${active ? ' active' : ''}" data-id="${course.id}">
        <div class="cli-name">${escapeHtml(course.name)}</div>
        <div class="cli-subject">${escapeHtml(course.subject)}</div>
        <div class="cli-progress">
          <div class="progress-bar" style="height:4px;">
            <div class="progress-fill${pct===100?' done':''}" style="width:${pct}%"></div>
          </div>
          <span class="cli-pct">${pct}%</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.course-list-item').forEach(el => {
    el.addEventListener('click', () => selectCourse(el.dataset.id));
  });
}

// ── Select course → render detail ────────────────────────────
function selectCourse(courseId) {
  selectedCourseId = courseId;
  renderCourseList(); // update active state
  renderCourseDetail();
  renderMonthGoalPanel();
}

// ── Course detail ─────────────────────────────────────────────
function renderCourseDetail() {
  const course = state.courses.find(c => c.id === selectedCourseId);
  if (!course) return;

  const units   = state.units.filter(u => u.course_id === course.id)
                             .sort((a, b) => a.unit_number - b.unit_number);
  const done    = units.filter(u => u.is_completed).length;
  const total   = course.total_units;
  const pct     = total ? Math.round((done / total) * 100) : 0;
  const scheduled = units.filter(u => u.scheduled_date && !u.is_completed).length;

  // Header
  document.getElementById('detail-course-name').textContent    = course.name;
  document.getElementById('detail-course-subject').textContent = course.subject;
  document.getElementById('detail-done').textContent           = done;
  document.getElementById('detail-total').textContent          = total;
  document.getElementById('detail-pct').textContent            = pct + '%';
  document.getElementById('detail-scheduled').textContent      = scheduled;
  const bar = document.getElementById('detail-progress-bar');
  bar.style.width = pct + '%';
  bar.className = `progress-fill${pct===100?' done':pct<30?' warn':''}`;

  // Unit grid
  renderUnitGrid(units);
}

// ── Unit grid ─────────────────────────────────────────────────
function renderUnitGrid(units) {
  const container = document.getElementById('unit-grid');
  if (!container) return;

  container.innerHTML = units.map(u => {
    let cls = 'unit-cell';
    if (u.is_completed)   cls += ' completed';
    if (u.scheduled_date && !u.is_completed) cls += ' scheduled';

    const tooltip = u.scheduled_date
      ? (u.is_completed ? `完了 ${u.completed_at}` : `予定日: ${u.scheduled_date}`)
      : (u.is_completed ? `完了 ${u.completed_at}` : '');

    return `<div class="${cls}" data-id="${u.id}" title="${tooltip}">${u.unit_number}</div>`;
  }).join('');

  container.querySelectorAll('.unit-cell').forEach(el => {
    el.addEventListener('click', () => openUnitModal(el.dataset.id));
  });
}

// ── Unit modal ────────────────────────────────────────────────
function openUnitModal(unitId) {
  const unit   = state.units.find(u => u.id === unitId);
  const course = state.courses.find(c => c.id === unit?.course_id);
  if (!unit || !course) return;

  document.getElementById('unit-modal-title').textContent    = `第${unit.unit_number}コマ — ${course.name}`;
  document.getElementById('unit-completed-check').checked    = unit.is_completed;
  document.getElementById('unit-completed-date').value       = unit.completed_at || '';
  document.getElementById('unit-scheduled-date').value       = unit.scheduled_date || '';
  document.getElementById('unit-completed-date').disabled    = !unit.is_completed;

  // completed_at visibility
  document.getElementById('unit-completed-date-row').style.display = unit.is_completed ? '' : 'none';

  document.getElementById('unit-modal').dataset.unitId = unitId;
  document.getElementById('unit-modal').showModal();
}

// ── Month goal panel ──────────────────────────────────────────
function renderMonthGoalPanel() {
  const course = state.courses.find(c => c.id === selectedCourseId);
  if (!course) return;

  const goal  = state.goals.find(g => g.course_id === selectedCourseId && g.year_month === currentMonth);
  const units = state.units.filter(u => u.course_id === selectedCourseId);
  const doneThisMonth = units.filter(u => u.is_completed && u.completed_at?.startsWith(currentMonth)).length;
  const goalUnits = goal?.goal_units ?? 0;
  const pct = goalUnits ? Math.min(100, Math.round((doneThisMonth / goalUnits) * 100)) : 0;

  document.getElementById('goal-month-label').textContent = currentMonth.replace('-', '年') + '月';
  document.getElementById('goal-input').value = goalUnits || '';

  const summary = document.getElementById('goal-summary');
  if (goalUnits) {
    summary.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:13px;color:var(--ink-2);">${doneThisMonth} / ${goalUnits} コマ達成</span>
        <span style="font-size:14px;font-weight:700;color:var(--green-dark);">${pct}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill${pct===100?' done':''}" style="width:${pct}%"></div>
      </div>
    `;
    summary.classList.remove('hidden');
  } else {
    summary.classList.add('hidden');
  }
}

// ── Event wiring ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Month selector in goal panel
  const monthSel = document.getElementById('goal-month-select');
  if (monthSel) {
    const now = new Date();
    for (let i = -1; i <= 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = formatYearMonth(d);
      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = `${d.getFullYear()}年${d.getMonth()+1}月`;
      if (ym === currentMonth) opt.selected = true;
      monthSel.appendChild(opt);
    }
    monthSel.addEventListener('change', () => {
      currentMonth = monthSel.value;
      renderMonthGoalPanel();
    });
  }

  // Save goal
  document.getElementById('goal-save-btn')?.addEventListener('click', async () => {
    const val = Number(document.getElementById('goal-input').value);
    if (!selectedCourseId || isNaN(val) || val < 0) return;
    try {
      await upsertGoal(selectedCourseId, currentMonth, val);
      renderMonthGoalPanel();
      showToast('目標を保存しました', 'success');
    } catch (e) {
      showToast('保存に失敗しました', 'error');
    }
  });

  // Unit modal: completed toggle
  document.getElementById('unit-completed-check')?.addEventListener('change', function() {
    document.getElementById('unit-completed-date-row').style.display = this.checked ? '' : 'none';
    document.getElementById('unit-completed-date').disabled = !this.checked;
  });

  // Unit modal: save
  document.getElementById('unit-save-btn')?.addEventListener('click', async () => {
    const modal   = document.getElementById('unit-modal');
    const unitId  = modal.dataset.unitId;
    const unit    = state.units.find(u => u.id === unitId);
    if (!unit) return;

    const newCompleted    = document.getElementById('unit-completed-check').checked;
    const newScheduledDate = document.getElementById('unit-scheduled-date').value || null;

    const saveBtn = document.getElementById('unit-save-btn');
    saveBtn.disabled = true;

    try {
      // 完了状態の変更
      if (newCompleted !== unit.is_completed) {
        await toggleUnitComplete(unitId);
      }

      // 予定日の変更（変更があった場合のみ）
      if (newScheduledDate !== unit.scheduled_date) {
        await setUnitScheduledDate(unitId, newScheduledDate);
      }

      modal.close();
      renderCourseDetail();
      renderMonthGoalPanel();
      showToast('保存しました', 'success');
    } catch (e) {
      showToast('保存に失敗しました: ' + e.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  // Delete course
  document.getElementById('delete-course-btn')?.addEventListener('click', async () => {
    const course = state.courses.find(c => c.id === selectedCourseId);
    if (!course) return;
    if (!confirm(`「${course.name}」を削除しますか？\nコマ記録・目標もすべて削除されます。`)) return;
    try {
      await deleteCourse(selectedCourseId);
      selectedCourseId = state.courses[0]?.id || null;
      renderCourseList();
      if (selectedCourseId) {
        renderCourseDetail();
        renderMonthGoalPanel();
      } else {
        document.getElementById('detail-area').innerHTML = `<div class="empty-state"><div class="icon">📚</div><p>講座を追加してください</p></div>`;
      }
      showToast('講座を削除しました');
    } catch (e) {
      showToast('削除に失敗しました', 'error');
    }
  });

  // Close modal buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('dialog')?.close());
  });

  // Add course modal (shared logic)
  document.getElementById('add-course-btn')?.addEventListener('click', () => {
    document.getElementById('add-course-modal').showModal();
  });

  document.getElementById('add-course-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name        = document.getElementById('course-name-input').value.trim();
    const subject     = document.getElementById('course-subject-input').value.trim();
    const total_units = Number(document.getElementById('course-units-input').value);
    if (!name || !subject || !total_units) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const { addCourse } = await import('./cloud.js');
      const newCourse = await addCourse({ name, subject, total_units });
      document.getElementById('add-course-modal').close();
      e.target.reset();
      renderCourseList();
      selectCourse(newCourse.id);
      showToast('講座を追加しました', 'success');
    } catch (err) {
      showToast('追加に失敗しました: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
});

init();