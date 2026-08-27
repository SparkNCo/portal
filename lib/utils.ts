import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const POPOVER_ANIMATION_CLASSES =
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'

// data-[highlighted] is the attribute Radix sets on whichever item is
// currently hovered/keyboard-active in menu-like primitives (DropdownMenu,
// Select, ContextMenu, ...) — shared here so every dropdown built on these
// primitives gets the same orange-on-hover treatment for free.
export const MENU_ITEM_BASE_CLASSES =
  'relative flex cursor-default select-none items-center rounded-sm py-1.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:text-primary'

// Route params read via useParams() aren't reliably decoded in this app, so a
// value like a customer's clientName can arrive still percent-encoded (or,
// after repeated navigations through a link that re-encodes it, encoded more
// than once). Decoding is idempotent on already-plain text, so this always
// normalizes back to the real string; falls back to the raw value only if
// it's not valid percent-encoding at all (e.g. contains a literal '%').
export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}