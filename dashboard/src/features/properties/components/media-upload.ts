// Shared helpers for staging and uploading property media. Kept out of the
// picker component file so React Fast Refresh stays happy (component modules
// should only export components).

// Per-file upload state, keyed by fileKey(). "pending" means queued but not yet
// started; "uploading" carries a 0..1 progress fraction.
export type MediaUpload = {
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
};

// Stable identity for a picked file, used both for de-duping re-selections and
// as a React key, and for keying upload progress to the right file.
export function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
