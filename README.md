# 東進受講トラッカー

東進ハイスクールの受講進捗を管理するWebアプリ。講座のコマ進捗・予定日管理・高速基礎マスターのステージ追跡・カレンダー連携をまとめて行える。

## 機能

- **ダッシュボード** — 全体完了率・今月の予定コマ・直近の模試をひと目で確認
- **講座別進捗** — コマ単位で完了チェック・受講予定日を設定（calendar_appに自動同期）
- **月ごと目標** — 講座ごとに月の目標コマ数を設定し達成率を追跡
- **高速基礎マスター** — ステージ完了チェック・取り組む月の設定
- **カレンダー** — 受講予定日と東進模試をカレンダー形式で表示

## 技術スタック

| 項目           | 内容                                     |
| -------------- | ---------------------------------------- |
| フロントエンド | HTML / CSS / Vanilla JS (ES Modules)     |
| バックエンド   | Supabase (PostgreSQL + Auth + RLS)       |
| デプロイ       | Netlify                                  |
| 外部連携       | calendar_app（同一Supabaseプロジェクト） |

## ファイル構成

```
toshin-tracker/
├── index.html          ダッシュボード
├── courses.html        講座別進捗
├── masters.html        高速基礎マスター
├── calendar.html       カレンダービュー
├── favicon.ico
├── favicon.svg
├── apple-touch-icon.png
├── js/
│   ├── config.js       Supabase接続設定
│   ├── state.js        グローバル状態・ユーティリティ
│   ├── auth.js         認証（ログイン・ログアウト）
│   ├── cloud.js        全テーブルCRUD・calendar連携
│   ├── home.js
│   ├── courses.js
│   ├── masters.js
│   └── calendar.js
└── style/
    ├── tokens.css      デザイントークン（色・余白・タイポ）
    ├── base.css        リセット・認証画面・共通UI
    └── components.css  ボタン・カード・モーダル・ナビ等
```

## Supabaseセットアップ

### 1. テーブル作成

`blueprint.md` に記載のSQLをSupabase SQL Editorで実行する。

### 2. 高速基礎マスターデータの投入

`toshin_masters` と `toshin_master_stages` は手動でINSERTする。

```sql
-- マスターを追加
INSERT INTO toshin_masters (name, subject, display_order) VALUES
  ('英単語1800', '英語', 1),
  ('英熟語750',  '英語', 2),
  ('英文法750',  '英語', 3);

-- ステージを追加（master_idは上記で生成されたUUIDを使用）
INSERT INTO toshin_master_stages (master_id, stage_number, name) VALUES
  ('<master_id>', 1, 'Stage 1'),
  ('<master_id>', 2, 'Stage 2');
```

### 3. calendar_appとの連携

同一Supabaseプロジェクトの `calendar_app` テーブルを利用する。受講予定日を設定すると `type = '東進受講'` のイベントが自動挿入される。模試は `type = '東進模試'` のイベントを読み取り表示する。

## デプロイ

Netlifyのダッシュボードからフォルダをドラッグ&ドロップするだけ。ビルドステップは不要。

```
Sites → Add new site → Deploy manually → フォルダをドロップ
```

## 設定変更

`js/config.js` のSupabase URLとPublishable Keyを自身のプロジェクトのものに差し替える。

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_KEY = "publishable_key";
```

## 著作権・免責事項について

このアプリは個人が独自に開発したツールであり、東進ハイスクール・ナガセ等とは一切関係がありません。アプリ内のデータ（進捗・目標・スケジュール等）はすべてユーザー自身が入力するものであり、東進の教材・コンテンツそのものは一切含みません。
