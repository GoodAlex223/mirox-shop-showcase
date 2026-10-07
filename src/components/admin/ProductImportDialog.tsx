"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImportResult {
  message: string;
  success: number;
  failed: number;
  errors: { row: number; sku: string; error: string }[];
}

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ProductImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ProductImportDialogProps) {
  const t = useTranslations("admin.productImport");
  const tCommon = useTranslations("admin.common");
  const [file, setFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    maxFiles: 1,
    disabled: isImporting,
  });

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/admin/products/import");
      if (!response.ok) throw new Error("Failed to download template");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product-import-template.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error(t("downloadTemplateError"));
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("updateExisting", updateExisting.toString());

      const response = await fetch("/api/admin/products/import", {
        method: "POST",
        body: formData,
      });

      const data: ImportResult = await response.json();

      if (!response.ok) {
        throw new Error((data as unknown as { error: string }).error || t("importFailed"));
      }

      setResult(data);

      if (data.success > 0) {
        toast.success(t("imported", { count: data.success }));
        onImportComplete();
      }

      if (data.failed > 0) {
        toast.warning(t("failed", { count: data.failed }));
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error instanceof Error ? error.message : t("importFailed"));
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setFile(null);
      setResult(null);
      setUpdateExisting(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            {t("downloadTemplate")}
          </Button>

          {/* File Drop Zone */}
          <div
            {...getRootProps()}
            className={cn(
              "flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50",
              isImporting && "pointer-events-none opacity-50"
            )}
          >
            <input {...getInputProps()} />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="text-primary h-8 w-8" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-muted-foreground text-xs">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <Upload className="text-muted-foreground h-8 w-8" />
                <p className="text-sm font-medium">
                  {isDragActive ? t("dropActive") : t("dragDrop")}
                </p>
                <p className="text-muted-foreground text-xs">{t("browseHint")}</p>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="updateExisting">{t("updateExisting")}</Label>
              <p className="text-muted-foreground text-xs">{t("updateExistingHint")}</p>
            </div>
            <Switch
              id="updateExisting"
              checked={updateExisting}
              onCheckedChange={setUpdateExisting}
              disabled={isImporting}
            />
          </div>

          {/* Import Result */}
          {result && (
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("resultSucceeded", { count: result.success })}
                </span>
                {result.failed > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" />
                    {t("resultFailed", { count: result.failed })}
                  </span>
                )}
              </div>

              {result.errors.length > 0 && (
                <ScrollArea className="h-[100px]">
                  <div className="space-y-1 text-xs">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-muted-foreground">
                        {t("rowError", { row: err.row, sku: err.sku, error: err.error })}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              {result ? t("close") : tCommon("cancel")}
            </Button>
            {!result && (
              <Button onClick={handleImport} disabled={!file || isImporting}>
                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isImporting ? t("importingLabel") : t("importButton")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
