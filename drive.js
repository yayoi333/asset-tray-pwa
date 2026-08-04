import { DRIVE_FOLDER_NAME, DRIVE_FILE_NAME } from "./config.js";
import { getAccessToken, invalidateToken } from "./auth.js";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

let cachedFileId = null;

async function apiFetch(url, opts = {}, { retryOn401 = true } = {}) {
  const token = await getAccessToken({ interactive: false }).catch(() => getAccessToken({ interactive: true }));
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });

  if (res.status === 401 && retryOn401) {
    invalidateToken();
    return apiFetch(url, opts, { retryOn401: false });
  }
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  return res;
}

async function findFileByName(name, { mimeType } = {}) {
  const clauses = [`name = '${name.replace(/'/g, "\\'")}'`, "trashed = false"];
  if (mimeType) clauses.push(`mimeType = '${mimeType}'`);
  const url = `${API}/files?q=${encodeURIComponent(clauses.join(" and "))}&fields=files(id,name)&pageSize=10`;
  const res = await apiFetch(url);
  const { files } = await res.json();
  return files?.[0]?.id || null;
}

async function createFolder(name) {
  const res = await apiFetch(`${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
  });
  return (await res.json()).id;
}

async function createJsonFile(name, parentId, data) {
  const boundary = `boundary${Date.now()}`;
  const metadata = { name, parents: parentId ? [parentId] : undefined, mimeType: "application/json" };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(data)}\r\n` +
    `--${boundary}--`;

  const res = await apiFetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await res.json()).id;
}

async function getOrCreateFileId() {
  if (cachedFileId) return cachedFileId;

  const existing = await findFileByName(DRIVE_FILE_NAME);
  if (existing) {
    cachedFileId = existing;
    return cachedFileId;
  }

  let folderId = await findFileByName(DRIVE_FOLDER_NAME, { mimeType: FOLDER_MIME });
  if (!folderId) folderId = await createFolder(DRIVE_FOLDER_NAME);

  cachedFileId = await createJsonFile(DRIVE_FILE_NAME, folderId, { version: 1, items: [] });
  return cachedFileId;
}

async function readAll() {
  const fileId = await getOrCreateFileId();
  const res = await apiFetch(`${API}/files/${fileId}?alt=media`);
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

async function writeAll(items) {
  const fileId = await getOrCreateFileId();
  await apiFetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, items }),
  });
}

/**
 * アイテムを1件追記する。
 * 読み→追記→書き戻し。失敗したら1回だけ読み直して再試行する。
 */
export async function appendItem(item) {
  try {
    const items = await readAll();
    await writeAll([...items, item]);
  } catch (e) {
    const items = await readAll();
    await writeAll([...items, item]);
  }
}
