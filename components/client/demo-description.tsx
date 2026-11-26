"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/utils";
import { useProxiedImageUrl } from "@/hooks/use-proxied-image-url";

// A demo's description (demo_videos.description), or a piece of feedback on
// it (demo_comments.body): markdown from the rich text editor it's written in
// (bold, italics, lists, links — see RichTextEditor), shown below the video
// and on the Demos page. Plain text from before it was rich is markdown too,
// so it shows the same.
// `clamp`: just its first lines (the Demos page's cards), paragraphs run
// together so the clamp counts lines, not blocks.
// `allowImages`: feedback can have screenshots pasted in; descriptions can't.
// The editor saves a line break inside a paragraph (Shift+Enter, an empty
// line) as markdown's "\" at the end of the line. That only works when more
// text follows in the same paragraph: a "\" on its own line, or ending a
// paragraph, would show as a literal "\". Plain newlines instead (shown as
// breaks by remark-breaks). Other escapes ("\*") are left alone.
export function withoutBackslashBreaks(markdown: string): string {
  return markdown.replace(/\\(?=\r?\n|$)/g, "");
}

// Images uploaded from the editor live on Linear (uploads.linear.app), which
// needs Linear's key to serve them: shown through the portal's proxy, as in
// the ticket modal. Opens full size in a new tab.
function MarkdownImage({ src, alt }: Readonly<{ src?: string; alt?: string }>) {
  const resolvedSrc = useProxiedImageUrl(src);
  if (!resolvedSrc) return null;
  return (
    <a href={resolvedSrc} target="_blank" rel="noopener noreferrer" className="my-1.5 block w-fit">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvedSrc}
        alt={alt ?? ""}
        loading="lazy"
        className="max-h-72 max-w-full rounded-md border border-surface-line object-contain"
      />
    </a>
  );
}

export function DemoDescription({
  markdown,
  clamp = false,
  allowImages = false,
  className,
}: Readonly<{ markdown: string; clamp?: boolean; allowImages?: boolean; className?: string }>) {
  return (
    <div
      className={cn(
        "text-muted-foreground break-words leading-relaxed",
        "[&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic [&_u]:underline",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        clamp
          ? "line-clamp-2 [&_p]:inline [&_p]:after:content-['_'] [&_ul]:inline [&_ol]:inline [&_li]:inline"
          : "[&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-1.5",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        // No raw HTML ever; images only where asked for (and never clamped).
        disallowedElements={allowImages && !clamp ? [] : ["img"]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) => <MarkdownImage src={typeof src === "string" ? src : undefined} alt={alt} />,
        }}
      >
        {withoutBackslashBreaks(markdown)}
      </ReactMarkdown>
    </div>
  );
}
