"use client"

import type { ReactNode } from "react";
import { Menu } from "lucide-react"
import { useSidebar } from "@/lib/sidebar-context";

interface HeaderProps {
  title: string
  subtitle?: string
  /** Override the subtitle's default text-sm sizing for a specific page — e.g. "smalltext" for 16px. */
  subtitleClassName?: string
  /** Optional right-aligned slot for page-specific buttons (e.g. "Log Hours"). */
  actions?: ReactNode
}

export function Header({ title, subtitle, subtitleClassName, actions }: HeaderProps) {
  const { open } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 justify-between border-b border-border bg-background/95 backdrop-blur px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={open}
          className="lg:hidden -ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-primary"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {subtitle && (
            <p className={`${subtitleClassName ?? "text-sm"} text-muted-foreground`}>{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
