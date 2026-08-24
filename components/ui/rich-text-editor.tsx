"use client";

import { useEffect } from "react";
import {
  useEditor,
  EditorContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  List,
  ListOrdered,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProxiedImageUrl } from "@/hooks/use-proxied-image-url";

// Linear-hosted image URLs (uploads.linear.app) require Linear's own API key to
// load — a plain <img src> just 401s, which browsers render as the alt text (often
// literally the filename, e.g. "image.png") in place of the picture. This node view
// swaps in the same authenticated-proxy fetch the read-only markdown renderer uses
// (issue-detail-modal.tsx's ProxiedImage) so images actually display in the editor.
function ProxiedImageNodeView({ node }: Readonly<NodeViewProps>) {
  const resolvedSrc = useProxiedImageUrl(node.attrs.src);

  return (
    <NodeViewWrapper as="span" className="inline-block max-w-full">
      {resolvedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedSrc}
          alt={node.attrs.alt ?? ""}
          className="max-w-full h-auto rounded-md my-2"
        />
      ) : (
        <span className="inline-flex items-center rounded border border-border bg-muted/40 px-2 py-1 smalltext text-muted-foreground">
          Loading image…
        </span>
      )}
    </NodeViewWrapper>
  );
}

const ProxiedImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ProxiedImageNodeView);
  },
});

function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
}

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: Readonly<{
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: Readonly<{ editor: Editor }>) {
  return (
    <div className="flex items-center gap-1 border-b border-input px-2 py-1.5 flex-wrap">
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarButton
        label="Heading"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "90px",
  id,
  ariaLabel,
}: Readonly<{
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  id?: string;
  ariaLabel?: string;
}>) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      ProxiedImage.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: false,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        class:
          "prose prose-sm !text-smalltext max-w-none text-card-foreground focus:outline-none [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-semibold [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-2",
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(getMarkdown(editor));
    },
  });

  // Keep the editor in sync when the field is reset/cleared externally
  // (e.g. switching issue type or closing/reopening the modal).
  useEffect(() => {
    if (!editor) return;
    const current = getMarkdown(editor);
    if (value !== current) {
      editor.commands.setContent(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-secondary focus-within:ring-1 focus-within:ring-ring",
        className,
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="px-3 py-2 smalltext overflow-y-auto cursor-text"
        style={{ minHeight }}
        onClick={() => editor.chain().focus().run()}
      />
    </div>
  );
}
