"use client";

import { useEffect, useState } from "react";
import { API_HEADERS } from "@/lib/api-headers";

// Linear-hosted attachments (issue description images, UAT/QA evidence) require
// Linear's own API key to view — portal users don't have a Linear account, so their
// browser can't load these URLs directly. Route them through our backend proxy, which
// fetches with our key instead.
export const LINEAR_UPLOAD_HOST = "uploads.linear.app";

// A plain <img src> can't send the Authorization header Supabase's gateway requires
// (query-param apikey alone is no longer accepted — it 401s before the request even
// reaches the function), so this fetches the image with the proper headers and hands
// back a blob URL instead.
//
// Cached by source URL (module-level, outside the hook) so the same image is only
// ever fetched once — without this, every remount (React Strict Mode's double effect
// invocation in dev, or the same attachment rendered by more than one consumer)
// re-fetched and revoked-then-recreated the blob URL right as the <img> was
// displaying it, producing a visible flash. Never revoked: these are small
// thumbnails and the cache lives for the page's lifetime, same trade-off as the
// browser's own image cache.
const proxiedImageCache = new Map<string, string>();

export function useProxiedImageUrl(url: string | undefined | null) {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(() =>
    url ? proxiedImageCache.get(url) : undefined,
  );

  useEffect(() => {
    if (!url) {
      setResolvedUrl(undefined);
      return;
    }

    const cached = proxiedImageCache.get(url);
    if (cached) {
      setResolvedUrl(cached);
      return;
    }

    let isLinearUpload: boolean;
    try {
      isLinearUpload = new URL(url).hostname === LINEAR_UPLOAD_HOST;
    } catch {
      isLinearUpload = false;
    }

    if (!isLinearUpload) {
      setResolvedUrl(url);
      return;
    }

    let cancelled = false;

    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/linear-image-proxy?url=${encodeURIComponent(url)}`,
      { headers: API_HEADERS },
    )
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error("Failed to load image"))))
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        proxiedImageCache.set(url, objectUrl);
        setResolvedUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setResolvedUrl(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return resolvedUrl;
}
