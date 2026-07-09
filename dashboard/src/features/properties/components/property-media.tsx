import { useState } from "react";
import { ChevronLeft, ChevronRight, Film, Paperclip } from "lucide-react";

import { getErrorMessage } from "@/core/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MEDIA_PAGE_SIZE, usePropertyMedia } from "../api/media.queries";
import type { MediaWithUrl } from "../types";

// Last path segment of a storage key, used as a human-readable label/alt text
// (keys look like "properties/<id>/images/kitchen.jpg").
function fileName(storageKey: string): string {
  return storageKey.split("/").pop() ?? storageKey;
}

// A single media tile: image thumbnails render inline; videos and other files
// fall back to a labelled icon since they have no cheap thumbnail here.
function MediaTile({ media }: { media: MediaWithUrl }) {
  const name = fileName(media.storage_key);
  const isImage = media.content_type.startsWith("image/");
  const isVideo = media.content_type.startsWith("video/");

  if (isImage) {
    return (
      <a
        href={media.url}
        target="_blank"
        rel="noreferrer"
        className="group block aspect-square overflow-hidden rounded-lg border"
      >
        <img
          src={media.url}
          alt={name}
          loading="lazy"
          className="size-full object-cover transition-transform group-hover:scale-105"
        />
      </a>
    );
  }

  const Icon = isVideo ? Film : Paperclip;
  return (
    <a
      href={media.url}
      target="_blank"
      rel="noreferrer"
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 p-3 text-center hover:bg-muted"
    >
      <Icon className="size-6 text-muted-foreground" />
      <span className="line-clamp-2 text-xs text-muted-foreground">{name}</span>
    </a>
  );
}

// The media section shown on the property details page: the property's media
// laid out as a responsive grid. Prop-driven (takes the property id) so it can
// be tested without a router.
export function PropertyMedia({ propertyId }: { propertyId: string }) {
  const [page, setPage] = useState(0);
  const { data, isPending, isError, error, isPlaceholderData } =
    usePropertyMedia(propertyId, page);

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / MEDIA_PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = page < pageCount - 1;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Media</h2>
        <p className="text-sm text-muted-foreground">
          Photos and documents for this property.
        </p>
      </div>

      {isPending && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data && data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No media yet.</p>
      )}
      {data && data.items.length > 0 && (
        <>
          <div
            className={cn(
              "grid grid-cols-2 gap-3 sm:grid-cols-3",
              // Dim the grid while the next page is still loading.
              isPlaceholderData && "opacity-60",
            )}
          >
            {data.items.map((media) => (
              <MediaTile key={media.id} media={media} />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {pageCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
