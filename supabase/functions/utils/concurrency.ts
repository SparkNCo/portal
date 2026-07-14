// @ts-nocheck

// Runs `worker` over `items` with at most `limit` in flight at once, instead of
// one-at-a-time or all-at-once. Each item is started exactly once.
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  let next = 0;
  async function runNext(): Promise<void> {
    const i = next++;
    if (i >= items.length) return;
    await worker(items[i]);
    return runNext();
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runNext),
  );
}
