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
//
// text-popover-foreground is the important part for the *unhighlighted*
// state: every one of these primitives' *Content wrapper already sets that
// same color, so relying on inheritance looks redundant — but items land in
// a Radix portal appended straight to <body>, and this app's <body> sets its
// own `color` (the cream --foreground, meant for the dark page background)
// directly on the body tag. Depending on paint/hydration timing that can
// still win over the ancestor Content's color for an item's own text node,
// leaving every unhovered option effectively invisible (cream-on-cream)
// until data-highlighted's text-primary kicks in on hover. Setting it here
// too removes the dependency on inheritance entirely.
export const MENU_ITEM_BASE_CLASSES =
  'relative flex cursor-default select-none items-center rounded-sm py-1.5 text-sm text-popover-foreground outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:text-primary'

// `branchName` is Linear's auto-generated git branch suggestion (e.g.
// "santiago/spa-247-fix-login-bug"), not the clean ticket code — the actual
// TEAM-123 identifier is embedded in it as a letters-dash-digits run, with
// the digits stopping at the first non-digit character. Falls back to a
// blind slice for the rare branch name that doesn't match the pattern at
// all (e.g. one with no team-key prefix).
export function getIssueCode(branchName: string): string {
  const match = branchName.match(/[a-zA-Z]+-\d+/);
  return (match?.[0] ?? branchName.slice(0, 7)).toUpperCase();
}

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