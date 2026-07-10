import { useState } from "react";

import { uploadMedia, type MediaEntityType } from "../api/media.queries";
import { fileKey, type MediaUpload } from "./media-upload";

// Staging + sequential upload of media for an entity that doesn't exist yet at
// pick time (properties and units are both created first, then their staged
// files are uploaded). Shared by the property and unit create forms so the
// per-file progress bookkeeping lives in one place.
//
// `files`/`setFiles` back the MediaPicker; `uploads` drives its progress rings.
// Call `uploadAll(entityId)` after the entity is created: it uploads in order
// (the first file becomes the primary/cover), reporting progress per file. It
// resolves when every file is stored and throws on the first failure (leaving
// that file marked "error") so the caller can surface it.
export function useStagedMedia(entityType: MediaEntityType) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<Record<string, MediaUpload>>({});
  const [isUploading, setIsUploading] = useState(false);

  async function uploadAll(entityId: string): Promise<void> {
    if (files.length === 0) return;
    setIsUploading(true);
    // Mark every file queued up front so the picker shows a ring on each.
    setUploads(
      Object.fromEntries(
        files.map((file) => [
          fileKey(file),
          { status: "pending", progress: 0 } satisfies MediaUpload,
        ]),
      ),
    );
    try {
      for (const [index, file] of files.entries()) {
        const key = fileKey(file);
        const setState = (state: MediaUpload) =>
          setUploads((prev) => ({ ...prev, [key]: state }));
        setState({ status: "uploading", progress: 0 });
        try {
          await uploadMedia(entityType, entityId, file, {
            isPrimary: index === 0,
            displayOrder: index,
            onProgress: (fraction) =>
              setState({ status: "uploading", progress: fraction }),
          });
          setState({ status: "done", progress: 1 });
        } catch (error) {
          setState({ status: "error", progress: 0 });
          throw error;
        }
      }
    } finally {
      setIsUploading(false);
    }
  }

  return { files, setFiles, uploads, isUploading, uploadAll };
}
