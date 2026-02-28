import { state, formatYearMonth, escapeHtml, showToast } from './state.js';
import { fetchAll, toggleStageComplete, setStageMonthGoal } from './cloud.js';
import { initAuth, wireAuthForm, onLogin } from './auth.js';

let currentMonth = formatYearMonth(new Date());

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
  document.getElementById('masters-content').classList.toggle('hidden', on);
}

// ── Render all ───────────────────────────────────────────────
function renderAll() {
  renderKPI();
  renderMasterList();
}

// ── KPI ──────────────────────────────────────────────────────
function renderKPI() {
  const totalStages     = state.stages.length;
  const completedStages = state.progress.filter(p => p.is_completed).length;
  const pct = totalStages ? Math.round((completedStages / totalStages) * 100) : 0;

  const thisMonthGoals = state.progress.filter(p => p.year_month_goal === currentMonth).length;

  document.getElementById('kpi-stage-pct').textContent       = pct;
  document.getElementById('kpi-stages-done').textContent     = completedStages;
  document.getElementById('kpi-stages-total').textContent    = totalStages;
  document.getElementById('kpi-month-goals').textContent     = thisMonthGoals;
  document.getElementById('kpi-masters-count').textContent   = state.masters.length;
}

// ── Master list ───────────────────────────────────────────────
function renderMasterList() {
  const container = document.getElementById('master-list');
  if (!container) return;

  if (!state.masters.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚡</div>
        <p>高速基礎マスターのデータがまだ登録されていません</p>
        <p style="font-size:12px;margin-top:8px;">Supabaseの<code>toshin_masters</code>テーブルにデータを追加してください</p>
      </div>`;
    return;
  }

  container.innerHTML = state.masters.map(master => {
    const stages    = state.stages.filter(s => s.master_id === master.id);
    const doneCount = stages.filter(s => state.progress.find(p => p.stage_id === s.id && p.is_completed)).length;
    const pct       = stages.length ? Math.round((doneCount / stages.length) * 100) : 0;
    const thisMonthStages = stages.filter(s => {
      const p = state.progress.find(x => x.stage_id === s.id);
      return p?.year_month_goal === currentMonth;
    });

    return `
      <div class="master-card">
        <div class="master-card-header">
          <div>
            <div class="master-name">${escapeHtml(master.name)}</div>
            <span class="badge badge-green">${escapeHtml(master.subject)}</span>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:20px;font-weight:700;color:var(--green-dark);">${pct}%</div>
            <div style="font-size:11px;color:var(--ink-3);">${doneCount} / ${stages.length} ステージ</div>
          </div>
        </div>
        <div class="progress-bar" style="margin-bottom:16px;">
          <div class="progress-fill${pct===100?' done':''}" style="width:${pct}%"></div>
        </div>
        ${thisMonthStages.length ? `
          <div style="font-size:12px;color:var(--green-dark);font-weight:600;margin-bottom:12px;">
            📌 今月の予定: ${thisMonthStages.map(s => escapeHtml(s.name)).join('、')}
          </div>
        ` : ''}
        <div class="stage-list">
          ${stages.map(stage => {
            const prog = state.progress.find(p => p.stage_id === stage.id);
            const done = prog?.is_completed ?? false;
            const goalMonth = prog?.year_month_goal;
            const isThisMonth = goalMonth === currentMonth;

            return `
              <div class="stage-item${done ? ' done' : ''}${isThisMonth ? ' this-month' : ''}" data-stage-id="${stage.id}">
                <div class="stage-check">
                  <div class="stage-checkbox${done ? ' checked' : ''}">
                    ${done ? '✓' : ''}
                  </div>
                </div>
                <div class="stage-info">
                  <div class="stage-name">${escapeHtml(stage.name)}</div>
                  ${done && prog?.completed_at ? `<div class="stage-date">完了: ${prog.completed_at}</div>` : ''}
                  ${!done && goalMonth ? `<div class="stage-date" style="color:var(--green-dark);">予定: ${goalMonth.replace('-','年')}月</div>` : ''}
                </div>
                <div class="stage-actions">
                  <button class="btn-icon stage-goal-btn" data-stage-id="${stage.id}" title="月目標を設定">📌</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  // ステージ完了トグル
  container.querySelectorAll('.stage-item').forEach(el => {
    el.querySelector('.stage-checkbox')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const stageId = el.dataset.stageId;
      try {
        await toggleStageComplete(stageId);
        renderAll();
        showToast('更新しました', 'success');
      } catch (err) {
        showToast('更新に失敗しました', 'error');
      }
    });
  });

  // 月目標ボタン
  container.querySelectorAll('.stage-goal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openGoalModal(btn.dataset.stageId);
    });
  });
}

// ── Goal modal ────────────────────────────────────────────────
function openGoalModal(stageId) {
  const stage  = state.stages.find(s => s.id === stageId);
  const master = state.masters.find(m => m.id === stage?.master_id);
  const prog   = state.progress.find(p => p.stage_id === stageId);

  document.getElementById('goal-modal-title').textContent = stage?.name || 'ステージ';
  document.getElementById('goal-modal-master').textContent = master?.name || '';
  document.getElementById('goal-modal').dataset.stageId = stageId;

  // populate select
  const sel = document.getElementById('goal-month-select');
  sel.innerHTML = '<option value="">設定しない</option>';
  const now = new Date();
  for (let i = 0; i <= 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = formatYearMonth(d);
    const opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = `${d.getFullYear()}年${d.getMonth()+1}月`;
    if (ym === (prog?.year_month_goal || currentMonth)) opt.selected = true;
    sel.appendChild(opt);
  }

  document.getElementById('goal-modal').showModal();
}

// ── Event wiring ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Month selector (KPI filter)
  const monthSel = document.getElementById('month-select');
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
      renderAll();
    });
  }

  // Goal modal save
  document.getElementById('goal-modal-save')?.addEventListener('click', async () => {
    const modal   = document.getElementById('goal-modal');
    const stageId = modal.dataset.stageId;
    const ym      = document.getElementById('goal-month-select').value;
    try {
      await setStageMonthGoal(stageId, ym || null);
      modal.close();
      renderAll();
      showToast('月目標を設定しました', 'success');
    } catch (e) {
      showToast('保存に失敗しました', 'error');
    }
  });

  // Close modals
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('dialog')?.close());
  });
});

init();
