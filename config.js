// 拡張機能(extension/lib/config.js)と「同じ」クライアントIDを入れること。
// 同一クライアントID = Driveから見て同一アプリ なので drive.file が両者で共有される。
export const GOOGLE_CLIENT_ID = "1049420713022-ntn2qrmfh6mqag4ssbcr9bnb2dg6a4m3.apps.googleusercontent.com";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_FOLDER_NAME = "素材ポイっと";
export const DRIVE_FILE_NAME = "assets.json";

export const isConfigured = () => GOOGLE_CLIENT_ID.trim().length > 0;
