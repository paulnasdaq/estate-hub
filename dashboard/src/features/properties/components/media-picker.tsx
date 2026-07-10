import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Film,
  ImageIcon,
  Paperclip,
  UploadCloud,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/ui/circular-progress";
import { fileKey, type MediaUpload } from "./media-upload";

const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${decimal.format(kb)} KB`;
  return `${decimal.format(kb / 1024)} MB`;
}

function iconFor(file: File) {
  if (file.type.startsWith("image/")) return ImageIcon;
  if (file.type.startsWith("video/")) return Film;
  return Paperclip;
}

// A controlled file-staging control: it holds no upload logic, just the list of
// files the parent will upload later. Supports click-to-pick and drag-and-drop,
// shows image thumbnails, and lets individual files be removed before upload.
export function MediaPicker({
  files,
  onChange,
  disabled = false,
  uploads,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  // Upload state per file, keyed by fileKey(). When present for a file, a
  // circular progress ring (or a done/error badge) is shown over its thumbnail.
  uploads?: Record<string, MediaUpload>;
}) {
  const [dragging, setDragging] = useState(false);

  // Object URLs for image thumbnails, rebuilt when the file list changes. The
  // cleanup effect revokes the previous map's URLs (on change/unmount) so we
  // don't leak blob URLs.
  const previews = useMemo(() => {
    const map = new Map<File, string>();
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        map.set(file, URL.createObjectURL(file));
      }
    }
    return map;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const url of previews.values()) URL.revokeObjectURL(url);
    };
  }, [previews]);

  function addFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const existing = new Set(files.map(fileKey));
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (!existing.has(fileKey(file))) next.push(file);
    }
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-input hover:bg-accent/50",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <UploadCloud className="size-6 text-muted-foreground" />
        <div className="text-sm">
          <span className="font-medium text-foreground">Click to upload</span>{" "}
          <span className="text-muted-foreground">or drag and drop</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Images, videos, or documents
        </p>
        <input
          type="file"
          multiple
          className="sr-only"
          aria-label="Add media files"
          disabled={disabled}
          onChange={(event) => {
            addFiles(event.target.files);
            // Reset so picking the same file again still fires onChange.
            event.target.value = "";
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {files.map((file, index) => {
            const Icon = iconFor(file);
            const preview = previews.get(file);
            const upload = uploads?.[fileKey(file)];
            const isActive =
              upload?.status === "pending" || upload?.status === "uploading";
            return (
              <li
                key={fileKey(file)}
                className="flex items-center gap-3 px-3 py-2"
              >
                <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                  {preview ? (
                    <img src={preview} alt="" className="size-full object-cover" />
                  ) : (
                    <Icon className="size-4 text-muted-foreground" />
                  )}
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <CircularProgress
                        size={24}
                        // "pending" has no fraction yet, so spin until it starts.
                        value={
                          upload.status === "uploading"
                            ? upload.progress
                            : undefined
                        }
                        className="text-primary"
                        aria-label={`Uploading ${file.name}`}
                      />
                    </div>
                  )}
                  {upload?.status === "done" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <Check className="size-5 text-primary" />
                    </div>
                  )}
                  {upload?.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/15">
                      <AlertCircle className="size-5 text-destructive" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {upload?.status === "uploading"
                      ? `Uploading… ${Math.round(upload.progress * 100)}%`
                      : upload?.status === "error"
                        ? "Upload failed"
                        : formatBytes(file.size)}
                  </p>
                </div>
                {/* Once an upload is in flight the list is frozen, so removal
                    only makes sense while still staging. */}
                {!upload && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    aria-label={`Remove ${file.name}`}
                    disabled={disabled}
                    onClick={() => removeAt(index)}
                  >
                    <X />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
