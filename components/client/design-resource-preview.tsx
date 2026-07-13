"use client";

import type React from "react";
import { useState } from "react";
import { ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import type { DesignResource } from "./design-resources.types";
import {
  getFigmaEmbedUrl,
  extractFigmaFileName,
  getV0DisplayTitle,
} from "@/lib/design-resource-utils";

type DesignResourcePreviewProps = {
  resource: DesignResource;
  onDelete?: (id: string) => void;
};

function FigmaPreview({ resource }: { resource: DesignResource }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const embedUrl = getFigmaEmbedUrl(resource.url);
  const displayName = resource.title || extractFigmaFileName(resource.url) || "Figma Design";

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 24C11.3137 24 14 21.3137 14 18V12H8C4.68629 12 2 14.6863 2 18C2 21.3137 4.68629 24 8 24Z" />
            <path d="M2 12C2 8.68629 4.68629 6 8 6H14V18H8C4.68629 18 2 15.3137 2 12Z" />
            <path d="M2 6C2 2.68629 4.68629 0 8 0H14V12H8C4.68629 12 2 9.31371 2 6Z" />
            <path d="M14 0H20C23.3137 0 26 2.68629 26 6C26 9.31371 23.3137 12 20 12H14V0Z" />
            <path d="M26 18C26 21.3137 23.3137 24 20 24C16.6863 24 14 21.3137 14 18C14 14.6863 16.6863 12 20 12C23.3137 12 26 14.6863 26 18Z" />
          </svg>
          <div>
            <p className="text-sm font-medium">{displayName}</p>
            {resource.description && (
              <p className="text-xs text-muted-foreground">{resource.description}</p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(resource.url, "_blank")}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative w-full" style={{ height: "500px" }}>
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Preview unavailable</p>
              <p className="text-xs text-muted-foreground mt-1">
                This Figma file cannot be embedded. It may be private or have restricted sharing settings.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(resource.url, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Figma
            </Button>
          </div>
        ) : (
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            allowFullScreen
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            title={displayName}
          />
        )}
      </div>
    </div>
  );
}

function V0Preview({ resource }: { resource: DesignResource }) {
  const displayName = resource.title || getV0DisplayTitle(resource.url);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" />
            <path d="M12 12L2 7L12 2L22 7L12 12Z" opacity="0.5" />
            <path d="M12 22V12" opacity="0.3" />
          </svg>
          <div>
            <p className="text-sm font-medium">{displayName}</p>
            {resource.description && (
              <p className="text-xs text-muted-foreground">{resource.description}</p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(resource.url, "_blank")}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-6 text-center">
        <div className="inline-flex flex-col items-center gap-3 p-6 rounded-lg bg-muted/50">
          <svg
            className="w-12 h-12 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" />
            <path d="M12 12L2 7L12 2L22 7L12 12Z" opacity="0.5" />
            <path d="M12 22V12" opacity="0.3" />
          </svg>
          <div>
            <p className="text-sm font-medium mb-1">v0 Design</p>
            <p className="text-xs text-muted-foreground max-w-sm mb-3">
              v0 designs cannot be embedded directly. Click below to view in v0.
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => window.open(resource.url, "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in v0
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DesignResourcePreview({
  resource,
  onDelete,
}: DesignResourcePreviewProps) {
  return (
    <div className="space-y-2">
      {resource.resource_type === "figma" ? (
        <FigmaPreview resource={resource} />
      ) : (
        <V0Preview resource={resource} />
      )}
      {onDelete && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(resource.id)}
            className="text-destructive hover:text-destructive"
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
