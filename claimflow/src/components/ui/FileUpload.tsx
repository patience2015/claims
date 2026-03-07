"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { UploadCloud, FileText, Image, X, CheckCircle, AlertCircle } from "lucide-react";

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export type FileUploadStatus = "idle" | "selected" | "uploading" | "success" | "error";

export interface FileWithStatus {
  file: File;
  status: FileUploadStatus;
  error?: string;
  /** Server-assigned document id after successful upload */
  documentId?: string;
}

interface FileUploadProps {
  /** Called when files are added or removed from the list */
  onFilesChange: (files: FileWithStatus[]) => void;
  files: FileWithStatus[];
  disabled?: boolean;
  className?: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <Image className="h-4 w-4 text-blue-500 flex-shrink-0" />;
  }
  return <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return `Format non autorisé (PDF, JPG, PNG uniquement)`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `Trop volumineux (max 10 Mo, taille actuelle : ${formatSize(file.size)})`;
  }
  return null;
}

export function FileUpload({ onFilesChange, files, disabled = false, className }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const newEntries: FileWithStatus[] = [];
      for (const file of incoming) {
        // Avoid duplicates by name + size
        const isDuplicate = files.some(
          (f) => f.file.name === file.name && f.file.size === file.size
        );
        if (isDuplicate) continue;
        const error = validateFile(file);
        newEntries.push({
          file,
          status: error ? "error" : "selected",
          error: error ?? undefined,
        });
      }
      if (newEntries.length > 0) {
        onFilesChange([...files, ...newEntries]);
      }
    },
    [files, onFilesChange]
  );

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    addFiles(selected);
    // Reset input so the same file can be re-added after removal
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Zone de dépôt de fichiers"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            inputRef.current?.click();
          }
        }}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          dragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />
        <UploadCloud
          className={cn(
            "h-8 w-8 mx-auto mb-2",
            dragging ? "text-blue-500" : "text-gray-400"
          )}
        />
        <p className="text-sm text-gray-600">
          Glissez-déposez ou{" "}
          <span className="text-blue-600 font-medium">parcourir</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          PDF, JPG, PNG · Max 10 Mo par fichier
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((entry, index) => (
            <li
              key={`${entry.file.name}-${entry.file.size}-${index}`}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border text-sm",
                entry.status === "error"
                  ? "bg-red-50 border-red-200"
                  : entry.status === "success"
                  ? "bg-green-50 border-green-200"
                  : "bg-gray-50 border-gray-200"
              )}
            >
              {/* File type icon */}
              {getFileIcon(entry.file.type)}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-gray-800">
                  {entry.file.name}
                </p>
                <p className="text-xs text-gray-500">{formatSize(entry.file.size)}</p>
                {entry.status === "error" && entry.error && (
                  <p className="text-xs text-red-600 mt-0.5">{entry.error}</p>
                )}
              </div>

              {/* Status indicator */}
              <div className="flex-shrink-0">
                {entry.status === "uploading" && (
                  <Spinner size="sm" className="text-blue-500" />
                )}
                {entry.status === "success" && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {entry.status === "error" && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>

              {/* Remove button — hidden while uploading */}
              {entry.status !== "uploading" && (
                <button
                  type="button"
                  aria-label={`Supprimer ${entry.file.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
