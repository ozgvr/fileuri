import Database from '@tauri-apps/plugin-sql';

let db = null;

export async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:fileuri.db');
  }
  return db;
}

// ── Helpers ─────────────────────────────────────────────

async function attachTags(d, rows) {
  if (rows.length === 0) return [];
  const paths = rows.map(r => r.path);
  const ph = paths.map((_, i) => `$${i + 1}`).join(',');
  const tagRows = await d.select(
    `SELECT file_path, tag FROM file_tags WHERE file_path IN (${ph})`,
    paths
  );
  const tagMap = {};
  for (const r of tagRows) {
    if (!tagMap[r.file_path]) tagMap[r.file_path] = [];
    tagMap[r.file_path].push(r.tag);
  }
  return rows.map(r => ({ ...r, tags: tagMap[r.path] || [] }));
}

const SORT_COLUMNS = {
  name: 'LOWER(f.name)',
  size: 'f.size',
  ext: "LOWER(CASE WHEN INSTR(f.name,'.') > 0 THEN SUBSTR(f.name, LENGTH(f.name) - LENGTH(REPLACE(f.name,'.','')) + 1) ELSE '' END)",
  created_at: 'f.created_at',
  indexed_at: 'f.indexed_at',
};

function buildOrderBy(sortBy, sortDir) {
  const col = SORT_COLUMNS[sortBy] || SORT_COLUMNS.created_at;
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${col} ${dir}`;
}

// ── Files ──────────────────────────────────────────────

export async function loadFiles() {
  const d = await getDb();
  const rows = await d.select(
    'SELECT path, name, size, created_at as createdAt, indexed_at as indexedAt FROM files ORDER BY indexed_at DESC'
  );
  return attachTags(d, rows);
}

export async function loadFilesPage(page = 0, pageSize = 10, sortBy = 'created_at', sortDir = 'desc') {
  const d = await getDb();
  const [{ total }] = await d.select('SELECT COUNT(*) as total FROM files');
  const orderBy = buildOrderBy(sortBy, sortDir);
  const rows = await d.select(
    `SELECT path, name, size, created_at as createdAt, indexed_at as indexedAt FROM files f ${orderBy} LIMIT $1 OFFSET $2`,
    [pageSize, page * pageSize]
  );
  return { files: await attachTags(d, rows), total };
}

export async function loadFilesByTag(tag, page = 0, pageSize = 10, sortBy = 'created_at', sortDir = 'desc') {
  const d = await getDb();
  const [{ total }] = await d.select(
    'SELECT COUNT(*) as total FROM file_tags WHERE tag = $1',
    [tag]
  );
  const orderBy = buildOrderBy(sortBy, sortDir);
  const rows = await d.select(
    `SELECT f.path, f.name, f.size, f.created_at as createdAt, f.indexed_at as indexedAt
     FROM files f
     INNER JOIN file_tags ft ON ft.file_path = f.path
     WHERE ft.tag = $1
     ${orderBy}
     LIMIT $2 OFFSET $3`,
    [tag, pageSize, page * pageSize]
  );
  return { files: await attachTags(d, rows), total };
}

export async function loadUntaggedFilesPage(page = 0, pageSize = 10, sortBy = 'created_at', sortDir = 'desc') {
  const d = await getDb();
  const [{ total }] = await d.select(
    `SELECT COUNT(*) as total
     FROM files f
     WHERE NOT EXISTS (SELECT 1 FROM file_tags ft WHERE ft.file_path = f.path)`
  );
  const orderBy = buildOrderBy(sortBy, sortDir);
  const rows = await d.select(
    `SELECT f.path, f.name, f.size, f.created_at as createdAt, f.indexed_at as indexedAt
     FROM files f
     WHERE NOT EXISTS (SELECT 1 FROM file_tags ft WHERE ft.file_path = f.path)
     ${orderBy}
     LIMIT $1 OFFSET $2`,
    [pageSize, page * pageSize]
  );
  return { files: await attachTags(d, rows), total };
}

export async function searchFiles(filters, page = 0, pageSize = 10, sortBy = 'created_at', sortDir = 'desc') {
  const d = await getDb();
  const conditions = [];
  const params = [];
  let idx = 1;

  for (const n of (filters.names || [])) {
    conditions.push(`(LOWER(f.name) LIKE $${idx} OR LOWER(f.path) LIKE $${idx})`);
    params.push(`%${n}%`);
    idx++;
  }
  for (const t of (filters.tags || [])) {
    conditions.push(
      `EXISTS (SELECT 1 FROM file_tags ft2 WHERE ft2.file_path = f.path AND LOWER(ft2.tag) = $${idx})`
    );
    params.push(t);
    idx++;
  }
  if ((filters.extensions || []).length > 0) {
    const extConds = filters.extensions.map(e => {
      const c = `LOWER(f.name) LIKE $${idx}`;
      params.push(`%.${e}`);
      idx++;
      return c;
    });
    conditions.push(`(${extConds.join(' OR ')})`);
  }
  for (const d of (filters.dates || [])) {
    if (d.op === 'eq') {
      conditions.push(`(f.created_at >= $${idx} AND f.created_at < $${idx + 1})`);
      params.push(d.start, d.end);
      idx += 2;
    } else if (d.op === 'gt') {
      conditions.push(`f.created_at > $${idx}`);
      params.push(d.value);
      idx += 1;
    } else if (d.op === 'lt') {
      conditions.push(`f.created_at < $${idx}`);
      params.push(d.value);
      idx += 1;
    }
  }

  for (const d of (filters.indexDates || [])) {
    if (d.op === 'eq') {
      conditions.push(`(f.indexed_at >= $${idx} AND f.indexed_at < $${idx + 1})`);
      params.push(d.start, d.end);
      idx += 2;
    } else if (d.op === 'gt') {
      conditions.push(`f.indexed_at > $${idx}`);
      params.push(d.value);
      idx += 1;
    } else if (d.op === 'lt') {
      conditions.push(`f.indexed_at < $${idx}`);
      params.push(d.value);
      idx += 1;
    }
  }

  if (filters.untagged) {
    conditions.push('NOT EXISTS (SELECT 1 FROM file_tags ft0 WHERE ft0.file_path = f.path)');
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const [{ total }] = await d.select(
    `SELECT COUNT(*) as total FROM files f ${where}`,
    params
  );
  const orderBy = buildOrderBy(sortBy, sortDir);
  const rows = await d.select(
    `SELECT f.path, f.name, f.size, f.created_at as createdAt, f.indexed_at as indexedAt FROM files f ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, pageSize, page * pageSize]
  );
  return { files: await attachTags(d, rows), total };
}

export async function loadAllTags() {
  const d = await getDb();
  const rows = await d.select(
    'SELECT tag, COUNT(*) as count FROM file_tags GROUP BY tag ORDER BY tag'
  );
  return rows;
}

export async function getUntaggedCount() {
  const d = await getDb();
  const [{ total }] = await d.select(
    `SELECT COUNT(*) as total
     FROM files f
     WHERE NOT EXISTS (SELECT 1 FROM file_tags ft WHERE ft.file_path = f.path)`
  );
  return total;
}

export async function getFileCount() {
  const d = await getDb();
  const [{ total }] = await d.select('SELECT COUNT(*) as total FROM files');
  return total;
}

export async function getExistingPaths(paths) {
  const d = await getDb();
  if (paths.length === 0) return new Set();
  const ph = paths.map((_, i) => `$${i + 1}`).join(',');
  const rows = await d.select(
    `SELECT path FROM files WHERE path IN (${ph})`,
    paths
  );
  return new Set(rows.map(r => r.path));
}

export async function insertFile(file) {
  const d = await getDb();
  const indexedAt = file.indexedAt || Date.now();
  await d.execute(
    'INSERT OR IGNORE INTO files (path, name, size, created_at, indexed_at) VALUES ($1, $2, $3, $4, $5)',
    [file.path, file.name, file.size, file.createdAt, indexedAt]
  );
  for (const tag of file.tags) {
    await d.execute(
      'INSERT OR IGNORE INTO file_tags (file_path, tag) VALUES ($1, $2)',
      [file.path, tag]
    );
  }
}

export async function updateFileTags(path, tags) {
  const d = await getDb();
  await d.execute('DELETE FROM file_tags WHERE file_path = $1', [path]);
  for (const tag of tags) {
    await d.execute(
      'INSERT INTO file_tags (file_path, tag) VALUES ($1, $2)',
      [path, tag]
    );
  }
}

export async function removeFile(path) {
  const d = await getDb();
  await d.execute('DELETE FROM file_tags WHERE file_path = $1', [path]);
  await d.execute('DELETE FROM files WHERE path = $1', [path]);
}

export async function renameTag(oldName, newName) {
  const d = await getDb();
  await d.execute(
    'UPDATE file_tags SET tag = $1 WHERE tag = $2',
    [newName, oldName]
  );
}

export async function deleteTag(tag) {
  const d = await getDb();
  await d.execute('DELETE FROM file_tags WHERE tag = $1', [tag]);
}

export async function clearAllFiles() {
  const d = await getDb();
  await d.execute('DELETE FROM file_tags');
  await d.execute('DELETE FROM files');
}

export async function importFiles(files) {
  const d = await getDb();
  await d.execute('DELETE FROM file_tags');
  await d.execute('DELETE FROM files');
  for (const f of files) {
    await d.execute(
      'INSERT OR IGNORE INTO files (path, name, size, created_at, indexed_at) VALUES ($1, $2, $3, $4, $5)',
      [f.path, f.name, f.size || 0, f.createdAt || Date.now(), f.indexedAt || Date.now()]
    );
    for (const tag of (f.tags || [])) {
      await d.execute(
        'INSERT OR IGNORE INTO file_tags (file_path, tag) VALUES ($1, $2)',
        [f.path, tag]
      );
    }
  }
}

// ── Settings ───────────────────────────────────────────

export async function getSetting(key) {
  const d = await getDb();
  const rows = await d.select('SELECT value FROM settings WHERE key = $1', [key]);
  if (rows.length === 0) return null;
  try { return JSON.parse(rows[0].value); } catch { return rows[0].value; }
}

export async function setSetting(key, value) {
  const d = await getDb();
  const json = JSON.stringify(value);
  await d.execute(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
    [key, json]
  );
}
