// Each user's own screen layout (portal.user_layout, hooks/use-user-layout.ts):
// the sidebar's menu order (SPA-581) and which panels they widened on pages
// other than the Dashboard.
// No imports, so the unit tests load it directly (tests/unit/user-layout.spec.ts).

// ── Menu order ──────────────────────────────────────────────────────────────

// Items in the saved order first; anything the saved order doesn't list (a
// page added since, or never moved) keeps its default order after them.
// Saved keys for pages this user doesn't have are ignored.
export function orderNavItems<T extends { href: string }>(items: T[], saved: string[] | null | undefined): T[] {
  if (!saved?.length) return items;
  const byKey = new Map(items.map((item) => [item.href, item]));
  const ordered: T[] = [];
  for (const key of saved) {
    const item = byKey.get(key);
    if (item && !ordered.includes(item)) ordered.push(item);
  }
  return [...ordered, ...items.filter((item) => !ordered.includes(item))];
}

// The keys after moving `from` onto `to`'s place; unchanged when either is
// missing or they're the same.
export function moveNavKey(keys: string[], from: string, to: string): string[] {
  const fromIndex = keys.indexOf(from);
  const toIndex = keys.indexOf(to);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return keys;
  const next = [...keys];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}

// ── Widened panels ──────────────────────────────────────────────────────────

// How a widened panel is stored: per page, since the same panel can show on
// more than one ("build:build_backlog").
export const expandedPanelKey = (page: string, panelId: string) => `${page}:${panelId}`;

// The list with that panel widened or back to half width.
export function setPanelExpanded(keys: string[], key: string, expanded: boolean): string[] {
  const without = keys.filter((k) => k !== key);
  return expanded ? [...without, key] : without;
}
