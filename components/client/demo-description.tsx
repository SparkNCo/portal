"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/utils";

// A demo's description (demo_videos.description): markdown from the rich
// text editor it's written in (bold, italics, lists, links — see
// RichTextEditor), shown below the video and on the Demos page. Plain text
// from before it was rich is markdown too, so it shows the same.
// `clamp`: just its first lines (the Demos page's cards), paragraphs run
// together so the clamp counts lines, not blocks.
// The editor saves a line break inside a paragraph (Shift+Enter, an empty
// line) as markdown's "\" at the end of the line. That only works when more
// text follows in the same paragraph: a "\" on its own line, or ending a
// paragraph, would show as a literal "\". Plain newlines instead (shown as
// breaks by remark-breaks). Other escapes ("\*") are left alone.
export function withoutBackslashBreaks(markdown: string): string {
  return markdown.replace(/\\(?=\r?\n|$)/g, "");
}

export function DemoDescription({
  markdown,
  clamp = false,
  className,
}: Readonly<{ markdown: string; clamp?: boolean; className?: string }>) {
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
        // Text only: no images or raw HTML in a demo's description.
        disallowedElements={["img"]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {withoutBackslashBreaks(markdown)}
      </ReactMarkdown>
    </div>
  );
}
