import { GOOGLE_CLIENT_ID, DRIVE_SCOPE, isConfigured } from "./config.js";

// トークンはメモリのみ。localStorage/IndexedDBには絶対に書かない。
let cached = null; // { token, expiresAt }
let tokenClient = null;
let gisReady = null;

const MARGIN_MS = 60_000;

function loadGis() {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google Identity Services を読み込めませんでした"));
    document.head.appendChild(script);
  });
  return gisReady;
}

async function ensureClient() {
  await loadGis();
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: () => {}, // requestAccessToken 呼び出しごとに差し替える
    });
  }
  return tokenClient;
}

/**
 * アクセストークンを返す。
 * @param {{ interactive?: boolean }} opts interactive:false なら同意画面を出さずに試す
 */
export async function getAccessToken({ interactive = true } = {}) {
  if (!isConfigured()) throw new Error("クライアントIDが未設定です(pwa/config.js)");
  if (cached && cached.expiresAt > Date.now() + MARGIN_MS) return cached.token;

  const client = await ensureClient();
  return new Promise((resolve, reject) => {
    client.callback = (res) => {
      if (res.error) {
        reject(new Error(res.error_description || res.error));
        return;
      }
      cached = { token: res.access_token, expiresAt: Date.now() + Number(res.expires_in || 3600) * 1000 };
      resolve(cached.token);
    };
    try {
      client.requestAccessToken({ prompt: interactive ? "" : "none" });
    } catch (e) {
      reject(e);
    }
  });
}

export function invalidateToken() {
  cached = null;
}

export function hasToken() {
  return !!(cached && cached.expiresAt > Date.now() + MARGIN_MS);
}
