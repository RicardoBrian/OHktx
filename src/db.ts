import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "ohktx.sqlite3"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  korail_id_enc TEXT,
  korail_pw_enc TEXT,
  card_number_enc TEXT,
  card_expiry_enc TEXT,
  card_birth_enc TEXT,
  card_password_enc TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dep_station TEXT NOT NULL,
  arr_station TEXT NOT NULL,
  travel_date TEXT NOT NULL,
  time_from TEXT NOT NULL DEFAULT '000000',
  time_to TEXT NOT NULL DEFAULT '235959',
  train_type TEXT NOT NULL DEFAULT 'ktx',
  seat_type TEXT NOT NULL DEFAULT 'any',
  passenger_count INTEGER NOT NULL DEFAULT 1,
  auto_pay INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  last_checked_at TEXT,
  last_notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER REFERENCES watches(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watches_status ON watches(status);
`);

// settings는 단일 행(id=1)만 사용
db.prepare(`INSERT OR IGNORE INTO settings (id) VALUES (1)`).run();

export interface Settings {
  id: number;
  korail_id_enc: string | null;
  korail_pw_enc: string | null;
  card_number_enc: string | null;
  card_expiry_enc: string | null;
  card_birth_enc: string | null;
  card_password_enc: string | null;
  updated_at: string;
}

export interface Watch {
  id: number;
  dep_station: string;
  arr_station: string;
  travel_date: string;
  time_from: string;
  time_to: string;
  train_type: string;
  seat_type: string;
  passenger_count: number;
  auto_pay: number;
  status: string;
  last_checked_at: string | null;
  last_notified_at: string | null;
  created_at: string;
}

export interface EventRow {
  id: number;
  watch_id: number | null;
  level: string;
  message: string;
  created_at: string;
}

export function getSettings(): Settings {
  return db.prepare(`SELECT * FROM settings WHERE id = 1`).get() as Settings;
}

export function logEvent(level: string, message: string, watchId: number | null = null) {
  db.prepare(`INSERT INTO events (watch_id, level, message) VALUES (?, ?, ?)`).run(watchId, level, message);
}

export function listActiveWatches(): Watch[] {
  return db.prepare(`SELECT * FROM watches WHERE status = 'active'`).all() as Watch[];
}

export function touchWatchChecked(id: number) {
  db.prepare(`UPDATE watches SET last_checked_at = datetime('now') WHERE id = ?`).run(id);
}

export function touchWatchNotified(id: number) {
  db.prepare(`UPDATE watches SET last_notified_at = datetime('now') WHERE id = ?`).run(id);
}

export function setWatchStatus(id: number, status: string) {
  db.prepare(`UPDATE watches SET status = ? WHERE id = ?`).run(status, id);
}

export function shouldNotifyNow(watch: Watch, cooldownMs: number): boolean {
  if (!watch.last_notified_at) return true;
  const last = new Date(watch.last_notified_at + "Z").getTime();
  return Date.now() - last >= cooldownMs;
}
