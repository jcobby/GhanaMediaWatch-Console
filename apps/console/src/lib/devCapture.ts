import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Write a raw API payload to disk, in development only.
 *
 * **Temporary.** Three of the endpoints this console depends on —
 * `/platform/routing`, `/editorial/queue`, `/org/inbox` — publish no response
 * schema, so the only way to learn what a field is actually called is to look at
 * a real response. Those endpoints need a platform or editor token, which is
 * granted server-side and cannot be minted from this machine, so the payload
 * cannot be fetched directly with curl either. Capturing what the signed-in
 * console already received is the one way to see it.
 *
 * Delete this module, and its two call sites, once the schemas are published or
 * the shapes are pinned in `normaliseRouting.ts`. It is not an error path: a
 * failure to write must never break the page the operator asked for.
 */
export async function captureDevPayload(name: string, payload: unknown): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;

  try {
    const dir = path.join(process.cwd(), '.data');
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${name}.json`),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8',
    );
  } catch {
    // A diagnostic that breaks the thing it is diagnosing is worse than none.
  }
}
