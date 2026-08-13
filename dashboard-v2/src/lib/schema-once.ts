const done = new Set<string>();
const inflight = new Map<string, Promise<void>>();

/** Run DDL at most once per isolate. Later calls are no-ops. */
export function onceSchema(key: string, fn: () => Promise<void>): Promise<void> {
  if (done.has(key)) return Promise.resolve();
  const existing = inflight.get(key);
  if (existing) return existing;
  const run = fn()
    .then(() => {
      done.add(key);
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, run);
  return run;
}
