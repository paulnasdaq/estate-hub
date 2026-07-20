import { api, unwrap } from "@/core/api/client";
import type { Organization } from "../types";

// Browsers leave `file.type` empty for some files; storage/backend need a
// concrete MIME type, so fall back to the generic binary type.
function contentTypeOf(file: File): string {
  return file.type || "application/octet-stream";
}

// Upload an organization's logo. Three steps, mirroring the media flow:
//   1. Ask the API for a presigned PUT URL (scoped to the organization).
//   2. PUT the bytes straight to storage (not through our API).
//   3. Record the object's public URL on the organization, which the backend
//      only accepts once the object actually exists in storage.
export async function uploadOrganizationLogo(
  orgId: string,
  file: File,
): Promise<Organization> {
  const contentType = contentTypeOf(file);

  const presign = await unwrap(
    api.POST("/api/v1/organizations/{org_id}/logo/presigns", {
      params: { path: { org_id: orgId } },
      body: { filename: file.name, content_type: contentType },
    }),
  );

  // Straight to the storage backend (not our API), so this skips our auth
  // middleware and base URL.
  const res = await globalThis.fetch(presign.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Failed to upload logo (${res.status})`);
  }

  return unwrap(
    api.PUT("/api/v1/organizations/{org_id}/logo", {
      params: { path: { org_id: orgId } },
      body: { storage_key: presign.storage_key },
    }),
  );
}

export async function removeOrganizationLogo(
  orgId: string,
): Promise<Organization> {
  return unwrap(
    api.DELETE("/api/v1/organizations/{org_id}/logo", {
      params: { path: { org_id: orgId } },
    }),
  );
}
