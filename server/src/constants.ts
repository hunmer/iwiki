import path from 'path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
export const DOCS_DIR = path.resolve(DATA_DIR, 'docs');
export const DB_PATH = path.resolve(DATA_DIR, 'wiki.db');
