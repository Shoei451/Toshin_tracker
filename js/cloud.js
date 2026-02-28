import { db } from './config.js';
import { state, uid, formatDate, showToast } from './state.js';

// ── Courses ──────────────────────────────────────────────────
export async function fetchCourses() {
  const { data, error } = await db
    .from('toshin_courses')
    .select('*')
    .eq('user_id', state.user.id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  state.courses = data || [];
}

export async function addCourse({ name, subject, total_units }) {
  const row = { id: uid(), user_id: state.user.id, name, subject, total_units: Number(total_units) };
  const { error } = await db.from('toshin_courses').insert(row);
  if (error) throw error;
  // コマを total_units 分自動生成
  await ensureUnits(row.id, Number(total_units));
  state.courses.push(row);
  return row;
}

export async function deleteCourse(courseId) {
  const { error } = await db.from('toshin_courses').delete().eq('id', courseId);
  if (error) throw error;
  state.courses = state.courses.filter(c => c.id !== courseId);
  state.units   = state.units.filter(u => u.course_id !== courseId);
  state.goals   = state.goals.filter(g => g.course_id !== courseId);
}

// ── Units ────────────────────────────────────────────────────
export async function fetchUnits() {
  if (!state.courses.length) return;
  const courseIds = state.courses.map(c => c.id);
  const { data, error } = await db
    .from('toshin_units')
    .select('*')
    .in('course_id', courseIds)
    .order('unit_number', { ascending: true });
  if (error) throw error;
  state.units = data || [];
}

// 講座追加時にコマ行をまとめて生成
export async function ensureUnits(courseId, totalUnits) {
  const existing = state.units.filter(u => u.course_id === courseId).map(u => u.unit_number);
  const toInsert = [];
  for (let n = 1; n <= totalUnits; n++) {
    if (!existing.includes(n)) {
      toInsert.push({ id: uid(), course_id: courseId, unit_number: n, is_completed: false });
    }
  }
  if (toInsert.length) {
    const { error } = await db.from('toshin_units').insert(toInsert);
    if (error) throw error;
    state.units.push(...toInsert);
  }
}

export async function toggleUnitComplete(unitId) {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit) return;
  const newVal = !unit.is_completed;
  const update = { is_completed: newVal, completed_at: newVal ? formatDate(new Date()) : null };
  const { error } = await db.from('toshin_units').update(update).eq('id', unitId);
  if (error) throw error;
  Object.assign(unit, update);
  return unit;
}

export async function setUnitScheduledDate(unitId, date) {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit) return;

  // calendar_appの古いイベントを削除
  if (unit.calendar_event_id) {
    await deleteCalendarEvent(unit.calendar_event_id);
  }

  let calendarEventId = null;
  if (date) {
    const course = state.courses.find(c => c.id === unit.course_id);
    calendarEventId = await insertCalendarEvent({
      date,
      title: `${course?.name || '東進'} 第${unit.unit_number}コマ`,
      course: course?.subject || '',
    });
  }

  const update = { scheduled_date: date || null, calendar_event_id: calendarEventId };
  const { error } = await db.from('toshin_units').update(update).eq('id', unitId);
  if (error) throw error;
  Object.assign(unit, update);
  return unit;
}

// ── Monthly goals ─────────────────────────────────────────────
export async function fetchGoals() {
  if (!state.courses.length) return;
  const courseIds = state.courses.map(c => c.id);
  const { data, error } = await db
    .from('toshin_monthly_goals')
    .select('*')
    .in('course_id', courseIds);
  if (error) throw error;
  state.goals = data || [];
}

export async function upsertGoal(courseId, yearMonth, goalUnits) {
  const existing = state.goals.find(g => g.course_id === courseId && g.year_month === yearMonth);
  if (existing) {
    const { error } = await db.from('toshin_monthly_goals')
      .update({ goal_units: goalUnits }).eq('id', existing.id);
    if (error) throw error;
    existing.goal_units = goalUnits;
  } else {
    const row = { id: uid(), course_id: courseId, year_month: yearMonth, goal_units: goalUnits };
    const { error } = await db.from('toshin_monthly_goals').insert(row);
    if (error) throw error;
    state.goals.push(row);
  }
}

// ── Masters ──────────────────────────────────────────────────
export async function fetchMasters() {
  const { data, error } = await db
    .from('toshin_masters')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw error;
  state.masters = data || [];
}

export async function fetchStages() {
  const { data, error } = await db
    .from('toshin_master_stages')
    .select('*')
    .order('stage_number', { ascending: true });
  if (error) throw error;
  state.stages = data || [];
}

export async function fetchProgress() {
  const { data, error } = await db
    .from('toshin_master_progress')
    .select('*')
    .eq('user_id', state.user.id);
  if (error) throw error;
  state.progress = data || [];
}

export async function toggleStageComplete(stageId) {
  const prog = state.progress.find(p => p.stage_id === stageId);
  if (prog) {
    const newVal = !prog.is_completed;
    const update = { is_completed: newVal, completed_at: newVal ? formatDate(new Date()) : null };
    const { error } = await db.from('toshin_master_progress').update(update).eq('id', prog.id);
    if (error) throw error;
    Object.assign(prog, update);
    return prog;
  } else {
    const row = { id: uid(), user_id: state.user.id, stage_id: stageId, is_completed: true, completed_at: formatDate(new Date()) };
    const { error } = await db.from('toshin_master_progress').insert(row);
    if (error) throw error;
    state.progress.push(row);
    return row;
  }
}

export async function setStageMonthGoal(stageId, yearMonth) {
  const prog = state.progress.find(p => p.stage_id === stageId);
  if (prog) {
    const { error } = await db.from('toshin_master_progress')
      .update({ year_month_goal: yearMonth }).eq('id', prog.id);
    if (error) throw error;
    prog.year_month_goal = yearMonth;
    return prog;
  } else {
    const row = { id: uid(), user_id: state.user.id, stage_id: stageId, is_completed: false, year_month_goal: yearMonth };
    const { error } = await db.from('toshin_master_progress').insert(row);
    if (error) throw error;
    state.progress.push(row);
    return row;
  }
}

// ── calendar_app 連携 ─────────────────────────────────────────
export async function fetchExams() {
  // calendar_appテーブルから東進模試のみfetch
  const { data, error } = await db
    .from('calendar_app')
    .select('id, date, title, notes')
    .eq('user_id', state.user.id)
    .eq('type', '東進模試')
    .order('date', { ascending: true });
  if (error) throw error;
  state.exams = data || [];
}

export async function insertCalendarEvent({ date, title, course }) {
  const eventId = uid();
  const { error } = await db.from('calendar_app').insert({
    id: eventId,
    user_id: state.user.id,
    date,
    title,
    course,
    type: '東進受講',
    notes: null,
    group_id: null,
  });
  if (error) throw error;
  return eventId;
}

export async function deleteCalendarEvent(eventId) {
  if (!eventId) return;
  const { error } = await db.from('calendar_app')
    .delete().eq('id', eventId).eq('user_id', state.user.id);
  if (error) console.warn('calendar event delete failed:', error.message);
}

// ── Fetch all data ────────────────────────────────────────────
export async function fetchAll() {
  await fetchCourses();
  await Promise.all([fetchUnits(), fetchGoals(), fetchMasters(), fetchStages(), fetchProgress(), fetchExams()]);
}
