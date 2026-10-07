import { NextRequest } from "next/server";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";
import { getPresignedUploadUrl, deleteFromS3, getKeyFromUrl } from "@/lib/s3";
import { z } from "zod";

const requestUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  folder: z.enum(["products", "categories", "avatars"]).optional(),
});

const deleteUploadSchema = z.object({
  url: z.string().url(),
});

// POST /api/admin/upload - Get presigned upload URL
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();

    const validationResult = requestUploadSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400);
    }

    const { filename, contentType, folder } = validationResult.data;

    // Validate content type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(contentType)) {
      return apiError("Invalid file type. Allowed: JPEG, PNG, WebP, GIF", 400);
    }

    // Check file extension
    const ext = filename.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "gif"];
    if (!ext || !allowedExtensions.includes(ext)) {
      return apiError("Invalid file extension", 400);
    }

    const result = await getPresignedUploadUrl(filename, contentType, folder);

    return apiSuccess(result);
  } catch {
    return apiError("Failed to generate upload URL", 500);
  }
}

// DELETE /api/admin/upload - Delete file from S3
export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();

    const validationResult = deleteUploadSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400);
    }

    const { url } = validationResult.data;

    const key = getKeyFromUrl(url);
    if (!key) {
      return apiError("Invalid file URL", 400);
    }

    await deleteFromS3(key);

    return apiSuccess({ message: "File deleted successfully" });
  } catch {
    return apiError("Failed to delete file", 500);
  }
}
