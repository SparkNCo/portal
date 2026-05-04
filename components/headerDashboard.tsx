"use client"

import { Menu } from "lucide-react"
import { useSidebar } from "@/lib/sidebar-context";

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { open } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 justify-between border-b border-border bg-background/95 backdrop-blur px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={open}
          className="lg:hidden -ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </header>
  )
}
