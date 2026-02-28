# 東進受講トラッカー 設計図

## ファイル構成

```
toshin-tracker/
├── index.html        # Home / ダッシュボード
├── courses.html      # 講座別進捗
├── masters.html      # 高速基礎マスター
├── calendar.html     # カレンダービュー（東進受講のみ）
├── js/
│   ├── config.js
│   ├── auth.js
│   ├── state.js
│   ├── cloud.js
│   ├── calendar-sync.js
│   ├── home.js
│   ├── courses.js
│   ├── masters.js
│   └── calendar.js
└── style/
    ├── tokens.css
    ├── base.css
    └── components.css
```

## supabase側SQL

```sql

-- 講座マスタ
create table toshin_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text not null,
  total_units int not null default 0,
  created_at timestamptz default now()
);

-- コマ記録
create table toshin_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references toshin_courses(id) on delete cascade,
  unit_number int not null,
  is_completed bool not null default false,
  completed_at date,
  scheduled_date date,
  calendar_event_id text,
  unique(course_id, unit_number)
);

-- 月ごと目標
create table toshin_monthly_goals (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references toshin_courses(id) on delete cascade,
  year_month text not null,
  goal_units int not null default 0,
  unique(course_id, year_month)
);

-- 高速基礎マスター（手動INSERT用）
create table toshin_masters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  display_order int not null default 0
);

-- ステージマスタ（手動INSERT用）
create table toshin_master_stages (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references toshin_masters(id) on delete cascade,
  stage_number int not null,
  name text not null
);

-- ステージ進捗
create table toshin_master_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stage_id uuid not null references toshin_master_stages(id) on delete cascade,
  is_completed bool not null default false,
  completed_at date,
  year_month_goal text,
  unique(user_id, stage_id)
);

-- RLS
alter table toshin_courses enable row level security;
alter table toshin_units enable row level security;
alter table toshin_monthly_goals enable row level security;
alter table toshin_master_progress enable row level security;
alter table toshin_masters enable row level security;
alter table toshin_master_stages enable row level security;

create policy "own courses" on toshin_courses for all using (auth.uid() = user_id);
create policy "own units" on toshin_units for all using (
  course_id in (select id from toshin_courses where user_id = auth.uid())
);
create policy "own goals" on toshin_monthly_goals for all using (
  course_id in (select id from toshin_courses where user_id = auth.uid())
);
create policy "own progress" on toshin_master_progress for all using (auth.uid() = user_id);
create policy "read masters" on toshin_masters for select using (true);
create policy "read stages" on toshin_master_stages for select using (true);

```
