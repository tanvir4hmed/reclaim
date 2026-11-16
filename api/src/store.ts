import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const KEEP = 1000;

export interface EchoRow {
  id: number;
  product: string;
  condition: string;
}

/**
 * The Echo store. One table, no identifiers: just what was left and when (Requirement 24.4).
 */
export class EchoStore {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS echoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product TEXT NOT NULL,
      condition TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`);
  }

  add(product: string, condition: string, now = Date.now()): number {
    const r = this.db
      .prepare('INSERT INTO echoes (product, condition, created_at) VALUES (?, ?, ?)')
      .run(product, condition, now);
    this.db.prepare('DELETE FROM echoes WHERE id <= (SELECT MAX(id) FROM echoes) - ?').run(KEEP);
    return Number(r.lastInsertRowid);
  }

  latest(limit = 5): EchoRow[] {
    return this.db
      .prepare('SELECT id, product, condition FROM echoes ORDER BY id DESC LIMIT ?')
      .all(limit) as unknown as EchoRow[];
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM echoes').get() as { n: number };
    return row.n;
  }

  close() {
    this.db.close();
  }
}
