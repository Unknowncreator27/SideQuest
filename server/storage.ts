import { initializeApp, cert, getApp, getApps, type App } from "firebase-admin/app";
import { ENV } from "./_core/env";
import fs from "fs";
import path from "path";

type StorageConfig =
  | { type: "forge"; baseUrl: string; apiKey: string }
  | { type: "firebase"; bucketName: string }
  | { type: "local"; uploadDir: string };

const FIREBASE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.VITE_FIREBASE_STORAGE_BUCKET ||
  `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "uploads");

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (baseUrl && apiKey) {
    return { type: "forge", baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    FIREBASE_BUCKET
  ) {
    console.log(`[Storage] Using Firebase Storage with bucket: ${FIREBASE_BUCKET}`);
    return { type: "firebase", bucketName: FIREBASE_BUCKET };
  }

  // Fallback to local filesystem storage (0 cost)
  console.log(`[Storage] Using local filesystem storage in: ${LOCAL_UPLOAD_DIR}`);
  return { type: "local", uploadDir: LOCAL_UPLOAD_DIR };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function getFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

async function getFirebaseBucket() {
  const app = getFirebaseApp();
  const { getStorage } = (await import("firebase-admin/storage")) as any;
  return getStorage(app).bucket(FIREBASE_BUCKET!);
}

function ensureUploadDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getLocalFilePath(uploadDir: string, relKey: string): string {
  const normalizedKey = relKey.replace(/^\/+/, "").replace(/\/+/g, "/");
  return path.join(uploadDir, normalizedKey);
}

function getLocalUrl(relKey: string): string {
  const normalizedKey = relKey.replace(/^\/+/, "");
  return `/uploads/${normalizedKey}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);

  if (config.type === "forge") {
    const uploadUrl = buildUploadUrl(config.baseUrl, key);
    const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: buildAuthHeaders(config.apiKey),
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(
        `Storage upload failed (${response.status} ${response.statusText}): ${message}`
      );
    }

    const url = (await response.json()).url;
    return { key, url };
  }

  if (config.type === "firebase") {
    const bucket = await getFirebaseBucket();
    const file = bucket.file(key);
    const buffer = typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);

    try {
      await file.save(buffer, {
        contentType,
        resumable: false,
      });

      const expiresAt = Date.now() + 1000 * 60 * 60; // 1 hour
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: new Date(expiresAt),
      });

      return { key, url };
    } catch (error: any) {
      if (error.message?.includes("does not exist")) {
        throw new Error(
          `Firebase Storage bucket "${FIREBASE_BUCKET}" does not exist. Please enable Firebase Storage in your Firebase Console for project "${process.env.FIREBASE_PROJECT_ID}" and ensure the bucket exists.`
        );
      }
      throw error;
    }
  }

  // Local filesystem storage
  ensureUploadDir(config.uploadDir);
  const filePath = getLocalFilePath(config.uploadDir, key);
  const dir = path.dirname(filePath);
  ensureUploadDir(dir);

  const buffer = typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);
  fs.writeFileSync(filePath, buffer);

  const url = getLocalUrl(key);
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);

  if (config.type === "forge") {
    return {
      key,
      url: await buildDownloadUrl(config.baseUrl, key, config.apiKey),
    };
  }

  if (config.type === "firebase") {
    const bucket = await getFirebaseBucket();
    const file = bucket.file(key);
    const expiresAt = Date.now() + 1000 * 60 * 60; // 1 hour
    try {
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: new Date(expiresAt),
      });

      return { key, url };
    } catch (error: any) {
      if (error.message?.includes("does not exist")) {
        throw new Error(
          `Firebase Storage bucket "${FIREBASE_BUCKET}" does not exist. Please enable Firebase Storage in your Firebase Console for project "${process.env.FIREBASE_PROJECT_ID}" and ensure the bucket exists.`
        );
      }
      throw error;
    }
  }

  // Local filesystem storage
  const filePath = getLocalFilePath(config.uploadDir, key);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${key}`);
  }

  const url = getLocalUrl(key);
  return { key, url };
}
