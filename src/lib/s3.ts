import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// G16: Cloudflare R2 is SigV4/S3-compatible — one optional endpoint is the
// only difference. Credentials + bucket stay in the AWS_* slots (single env
// contract, no R2_* fork). R2 ignores region and expects "auto"; real AWS
// keeps the old default. forcePathStyle: VERIFIED against the real bucket
// (G16 Task 11, 2026-08-31) — a presigned PUT to
// <account>.r2.cloudflarestorage.com/<bucket>/<key> returned 200 and the
// object read back 200 through the public r2.dev URL. Do not switch to
// virtual-host addressing without re-running that probe.
const endpoint = process.env.S3_ENDPOINT || undefined;

const s3Client = new S3Client({
  region: process.env.AWS_REGION || (endpoint ? "auto" : "us-east-1"),
  endpoint,
  forcePathStyle: Boolean(endpoint),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "";

// I3/G16 fix: kept as a plain (un-defaulted) string so getPresignedUploadUrl
// can tell "AWS_CLOUDFRONT_URL was explicitly configured" apart from "it
// fell back". CDN_URL below is the one place the fallback still applies —
// it stays legal for the legacy real-AWS path (see the check below).
const CLOUDFRONT_URL = process.env.AWS_CLOUDFRONT_URL || "";
const CDN_URL = CLOUDFRONT_URL || `https://${BUCKET_NAME}.s3.amazonaws.com`;

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

/**
 * I3/G16 fix: thrown by getPresignedUploadUrl — never at module load — so
 * merely importing this module (any test, or the one route that calls it)
 * never fails in an environment that hasn't configured R2 yet. Only an
 * actual upload attempt with a broken config throws.
 */
export class MissingCdnUrlError extends Error {
  constructor() {
    super(
      "S3_ENDPOINT is set (Cloudflare R2) but AWS_CLOUDFRONT_URL is not. Without it, the " +
        "presigned upload's publicUrl falls back to a *.s3.amazonaws.com host that R2 objects " +
        "are never reachable under — the upload would succeed but the URL persisted into " +
        "ProductImage.url would be permanently broken. Set AWS_CLOUDFRONT_URL to the R2 public " +
        "bucket URL (e.g. https://pub-xxxx.r2.dev, or your img.<domain> custom domain) before " +
        "uploading."
    );
    this.name = "MissingCdnUrlError";
  }
}

export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
  folder: string = "products"
): Promise<PresignedUploadResult> {
  // Once S3_ENDPOINT (R2) is configured, the *.s3.amazonaws.com fallback
  // below can never be correct — fail loudly instead of silently persisting
  // a dead image URL. The legacy real-AWS path (no endpoint) keeps the
  // fallback: it's the actually-reachable virtual-host URL there.
  if (endpoint && !CLOUDFRONT_URL) {
    throw new MissingCdnUrlError();
  }

  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `${folder}/${timestamp}-${sanitizedFilename}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes

  const publicUrl = `${CDN_URL}/${key}`;

  return { uploadUrl, publicUrl, key };
}

export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export function getKeyFromUrl(url: string): string | null {
  try {
    const cdnUrl = CDN_URL.replace(/\/$/, "");
    if (url.startsWith(cdnUrl)) {
      return url.replace(`${cdnUrl}/`, "");
    }

    // Handle S3 URLs
    const s3Pattern = new RegExp(`https?://${BUCKET_NAME}\\.s3[^/]*\\.amazonaws\\.com/(.+)`);
    const match = url.match(s3Pattern);
    if (match) {
      return match[1];
    }

    return null;
  } catch {
    return null;
  }
}

export { s3Client, BUCKET_NAME };
