// 拡張機能(extension/lib/config.js)と「同じ」クライアントIDを入れること。
// 同一クライアントID = Driveから見て同一アプリ なので drive.file が両者で共有される。
export const GOOGLE_CLIENT_ID = "";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_FOLDER_NAME = "素材ポイっと";
export const DRIVE_FILE_NAME = "assets.json";

export const isConfigured = () => GOOGLE_CLIENT_ID.trim().length > 0;
