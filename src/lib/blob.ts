import "server-only";
import { put, del } from "@vercel/blob";
import sharp from "sharp";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per spec §9
const MAX_DIMENSION = 2000; // long-edge resize per spec §9

export type UploadKind = "property-photo" | "expense-receipt" | "lease-pdf" | "work-photo";

// Server-side upload. Caller is expected to have validated the file via
// Zod / form parsing first; we re-check size and resize images here.
export async function uploadFile({
  kind,
  file,
  ownerId,
}: {
  kind: UploadKind;
  file: File;
  ownerId: string;
}): Promise<{ url: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error(`File exceeds ${MAX_BYTES / 1024 / 1024}MB limit`);
  }

  const isImage = file.type.startsWith("image/");
  let body: Buffer | File = file;
  let contentType = file.type || "application/octet-stream";

  if (isImage) {
    const arr = Buffer.from(await file.arrayBuffer());
    body = await sharp(arr)
      .rotate() // honour EXIF orientation before resizing
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .toBuffer();
    contentType = "image/jpeg";
  }

  const ext = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1] ?? "bin";
  const path = `${kind}/${ownerId}/${crypto.randomUUID()}.${ext}`;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Stub: in dev without Blob, return a pseudo URL so flows don't crash.
    return { url: `https://stub.local/${path}` };
  }

  const blob = await put(path, body, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return { url: blob.url };
}

export async function deleteFile(url: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  await del(url);
}
