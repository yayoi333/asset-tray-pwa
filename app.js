import { isConfigured } from "./config.js";
import { getAccessToken, hasToken } from "./auth.js";
import { appendItem } from "./drive.js";
import { enqueue, listQueue, dequeue } from "./queue.js";
import { ulid } from "./ulid.js";

const els = {
  text: document.getElementById("text"),
  sourceUrl: document.getElementById("sourceUrl"),
  memo: document.getElementById("memo"),
  pasteBtn: document.getElementById("pasteBtn"),
  sendBtn: document.getElementById("sendBtn"),
  signInBtn: document.getElementById("signInBtn"),
  status: document.getElementById("status"),
  recentList: document.getElementById("recentList"),
};

const X_URL = /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/\S+/i;
const ANY_URL = /https?:\/\/\S+/i;

/** 共有ペイロードからX投稿URLを拾う。text/urlどちらに入るかはアプリ・OSで揺れる。 */
function extractSourceUrl(params) {
  const joined = [params.get("url"), params.get("text"), params.get("title")].filter(Boolean).join("\n");
  return (joined.match(X_URL) || joined.match(ANY_URL) || [""])[0];
}

/** 共有テキストからURL部分を除いた本文を得る */
function extractBody(params, sourceUrl) {
  const text = params.get("text") || "";
  if (!text) return "";
  return sourceUrl ? text.replace(sourceUrl, "").trim() : text;
}

function applyShareParams() {
  const params = new URLSearchParams(location.search);
  if (![...params.keys()].length) return;

  const sourceUrl = extractSourceUrl(params);
  if (sourceUrl) els.sourceUrl.value = sourceUrl;

  const body = extractBody(params, sourceUrl);
  if (body) els.text.value = body;

  // 履歴にクエリを残さない(リロードで二重に反映されるのを防ぐ)
  history.replaceState(null, "", location.pathname);
}

function setStatus(message, kind = "") {
  els.status.textContent = message;
  els.status.className = `status ${kind}`;
}

function buildItem() {
  const now = new Date().toISOString();
  return {
    id: ulid(),
    text: els.text.value,
    tags: [],
    memo: els.memo.value.trim(),
    sourceUrl: els.sourceUrl.value.trim(),
    createdAt: now,
    updatedAt: now,
    device: "mobile",
    status: "inbox",
    deleted: false,
  };
}

async function onSend() {
  if (!els.text.value.trim()) {
    els.text.focus();
    return;
  }
  if (!isConfigured()) {
    setStatus("クライアントIDが未設定です(pwa/config.js)", "err");
    return;
  }

  const item = buildItem();
  els.sendBtn.disabled = true;
  setStatus("送信中...");

  try {
    await appendItem(item);
    clearForm();
    setStatus("PCの受信箱に送りました ✓", "ok");
    addRecent(item, true);
  } catch (e) {
    console.error(e);
    await enqueue(item);
    clearForm();
    setStatus("送信できなかったので保存しました。あとで自動再送します", "warn");
    addRecent(item, false);
  } finally {
    els.sendBtn.disabled = false;
  }
}

function clearForm() {
  els.text.value = "";
  els.memo.value = "";
  els.sourceUrl.value = "";
}

const recent = [];
function addRecent(item, sent) {
  recent.unshift({ ...item, sent });
  recent.splice(5);
  renderRecent();
}

function renderRecent() {
  els.recentList.innerHTML = "";
  for (const item of recent) {
    const li = document.createElement("li");
    li.textContent = `${item.sent ? "✓" : "⏳"} ${item.text.slice(0, 40)}`;
    els.recentList.appendChild(li);
  }
}

async function flushQueue() {
  if (!isConfigured()) return;
  const queued = await listQueue();
  if (queued.length === 0) return;

  let sent = 0;
  for (const item of queued) {
    try {
      await appendItem(item);
      await dequeue(item.id);
      sent++;
    } catch {
      break; // まだ送れない。次回起動時に再挑戦
    }
  }
  if (sent > 0) setStatus(`保留していた ${sent} 件を送信しました ✓`, "ok");
}

async function onPaste() {
  try {
    els.text.value = await navigator.clipboard.readText();
  } catch (e) {
    console.error(e);
    setStatus("クリップボードを読めませんでした。長押しで貼り付けてください", "warn");
  }
}

async function onSignIn() {
  try {
    await getAccessToken({ interactive: true });
    els.signInBtn.textContent = "サインイン済み";
    setStatus("Google Driveに接続しました ✓", "ok");
    flushQueue();
  } catch (e) {
    setStatus(`サインインに失敗しました: ${e.message}`, "err");
  }
}

els.pasteBtn.addEventListener("click", onPaste);
els.sendBtn.addEventListener("click", onSend);
els.signInBtn.addEventListener("click", onSignIn);

applyShareParams();
if (!isConfigured()) setStatus("クライアントIDが未設定です(pwa/config.js)", "err");
if (hasToken()) els.signInBtn.textContent = "サインイン済み";
flushQueue();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((e) => console.error(e));
}
