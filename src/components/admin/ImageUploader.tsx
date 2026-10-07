"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { Upload, X, Loader2, GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImageItem {
  id?: string;
  url: string;
  alt?: string;
  isNew?: boolean;
}

interface ImageUploaderProps {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  maxImages?: number;
  folder?: "products" | "categories" | "avatars";
}

export function ImageUploader({
  images,
  onChange,
  maxImages = 10,
  folder = "products",
}: ImageUploaderProps) {
  const t = useTranslations("admin.imageUploader");
  const [uploadingCount, setUploadingCount] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        // Get presigned URL
        const response = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            folder,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to get upload URL");
        }

        const { uploadUrl, publicUrl } = await response.json();

        // Upload file to S3
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file");
        }

        return publicUrl;
      } catch (error) {
        console.error("Upload error:", error);
        throw error;
      }
    },
    [folder]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const remainingSlots = maxImages - images.length;
      const filesToUpload = acceptedFiles.slice(0, remainingSlots);

      if (acceptedFiles.length > remainingSlots) {
        toast.warning(t("onlyNMore", { count: remainingSlots }));
      }

      if (filesToUpload.length === 0) return;

      setUploadingCount(filesToUpload.length);

      const newImages: ImageItem[] = [];

      for (const file of filesToUpload) {
        try {
          const url = await uploadFile(file);
          if (url) {
            newImages.push({ url, isNew: true });
          }
        } catch {
          toast.error(t("uploadFailed", { name: file.name }));
        }
      }

      if (newImages.length > 0) {
        onChange([...images, ...newImages]);
        toast.success(t("uploaded", { count: newImages.length }));
      }

      setUploadingCount(0);
    },
    [images, maxImages, onChange, uploadFile, t]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/gif": [".gif"],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    disabled: uploadingCount > 0 || images.length >= maxImages,
  });

  const removeImage = async (index: number) => {
    const image = images[index];

    // If it's a new image, try to delete from S3
    if (image.isNew) {
      try {
        await fetch("/api/admin/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: image.url }),
        });
      } catch (error) {
        console.error("Failed to delete from S3:", error);
      }
    }

    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);
    onChange(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image, index) => (
            <div
              key={image.url}
              className={cn(
                "group bg-muted relative aspect-square rounded-lg border",
                draggedIndex === index && "opacity-50"
              )}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <Image
                src={image.url}
                alt={image.alt || t("imageAlt", { index: index + 1 })}
                fill
                className="rounded-lg object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />

              {/* Overlay */}
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Position Badge */}
              {index === 0 && (
                <div className="bg-primary text-primary-foreground absolute top-2 left-2 rounded px-2 py-0.5 text-xs font-medium">
                  {t("mainBadge")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Zone */}
      {images.length < maxImages && (
        <div
          {...getRootProps()}
          className={cn(
            "flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50",
            uploadingCount > 0 && "pointer-events-none opacity-50"
          )}
        >
          <input {...getInputProps()} />

          {uploadingCount > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
              <p className="text-muted-foreground text-sm">
                {t("uploading", { count: uploadingCount })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <Upload className="text-muted-foreground h-8 w-8" />
              <div>
                <p className="text-sm font-medium">
                  {isDragActive ? t("dropActive") : t("dragDrop")}
                </p>
                <p className="text-muted-foreground text-xs">{t("browseHint")}</p>
              </div>
              <p className="text-muted-foreground text-xs">
                {t("countLabel", { count: images.length, max: maxImages })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
