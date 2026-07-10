import {
  keepPreviousData,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import type { Media } from "../types";

// How many media tiles a single grid page holds.
export const MEDIA_PAGE_SIZE = 12;

// Query definitions for a property's media, keyed under the property so
// uploads/deletes can invalidate a single property's list.
export const mediaQueries = {
  all: ["media"] as const,

  forProperty: (propertyId: string, params: { limit: number; offset: number }) =>
    queryOptions({
      // Pagination is part of the key so each page caches separately.
      queryKey: [...mediaQueries.all, "property", propertyId, params],
      queryFn: () =>
        unwrap(
          api.GET("/api/v1/properties/{property_id}/media", {
            params: {
              path: { property_id: propertyId },
              query: { limit: params.limit, offset: params.offset },
            },
          }),
        ),
    }),
};

export function usePropertyMedia(propertyId: string, page: number) {
  return useQuery({
    ...mediaQueries.forProperty(propertyId, {
      limit: MEDIA_PAGE_SIZE,
      offset: page * MEDIA_PAGE_SIZE,
    }),
    // Keep the current page visible while the next one loads so the grid
    // doesn't flash empty when paging.
    placeholderData: keepPreviousData,
  });
}

// Browsers leave `file.type` empty for some files; S3/backend need a concrete
// MIME type, so fall back to the generic binary type.
function contentTypeOf(file: File): string {
  return file.type || "application/octet-stream";
}

// PUT the bytes straight to storage, reporting upload progress as a 0..1
// fraction. We use XMLHttpRequest rather than fetch because fetch can't report
// request-body upload progress. MSW intercepts XHR too, so tests still work.
function putToStorage(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.addEventListener("progress", (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new Error(`Failed to upload ${file.name} (${xhr.status})`));
      }
    });
    xhr.addEventListener("error", () =>
      reject(new Error(`Failed to upload ${file.name}`)),
    );
    xhr.send(file);
  });
}

// Upload a single file as media for a property. Three steps, mirroring the
// backend's presign → direct-to-S3 → record flow:
//   1. Ask the API for a presigned PUT URL (keyed under the property).
//   2. PUT the bytes straight to S3 (not through our API).
//   3. Record the media row, which the backend only accepts once the object
//      actually exists in storage.
export async function uploadPropertyMedia(
  propertyId: string,
  file: File,
  options: {
    isPrimary?: boolean;
    displayOrder?: number;
    // Reports the storage-upload progress as a 0..1 fraction.
    onProgress?: (fraction: number) => void;
  } = {},
): Promise<Media> {
  const contentType = contentTypeOf(file);

  const presign = await unwrap(
    api.POST("/api/v1/properties/{property_id}/media/presigns", {
      params: { path: { property_id: propertyId } },
      body: { filename: file.name, content_type: contentType },
    }),
  );

  // The bytes go straight to the storage backend (not through our API), so this
  // skips our auth middleware and base URL.
  await putToStorage(presign.upload_url, file, contentType, options.onProgress);

  return unwrap(
    api.POST("/api/v1/media", {
      body: {
        entity_type: "property",
        entity_id: propertyId,
        storage_key: presign.storage_key,
        content_type: contentType,
        size_bytes: file.size,
        is_primary: options.isPrimary ?? false,
        display_order: options.displayOrder ?? 0,
      },
    }),
  );
}
