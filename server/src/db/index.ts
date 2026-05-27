import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.resolve(DATA_DIR, 'wiki.db');
const DOCS_DIR = path.resolve(DATA_DIR, 'docs');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
  _db.exec(schema);

  return _db;
}

export function getDocsDir(): string {
  return DOCS_DIR;
}

export function readDocContent(nodeId: string): string {
  const filePath = path.resolve(DOCS_DIR, `${nodeId}.md`);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

export function writeDocContent(nodeId: string, content: string): void {
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(path.resolve(DOCS_DIR, `${nodeId}.md`), content, 'utf8');
}

export function deleteDocContent(nodeId: string): void {
  const filePath = path.resolve(DOCS_DIR, `${nodeId}.md`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
