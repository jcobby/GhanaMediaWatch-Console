import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DOCUMENT_REQUIREMENTS, type DocumentId } from '@dawuro/core';
import { readSession } from '@/lib/session';
import { applicationFor, documentsRoot } from '@/lib/applications';

/**
 * Evidence, actually uploaded.
 *
 * The wizard's document slots took a file, kept its **name**, and threw the
 * bytes away. A certificate of incorporation recorded as the string
 * "cert.pdf" is not evidence of anything — an operator approving on the
 * strength of it is approving a filename. These are the documents that decide
 * whether an organisation gets access to footage of the public, so they are
 * either stored or not collected.
 *
 * Written under `.data/documents/<application>/`, beside the file that indexes
 * them. Nothing is served back to the browser from here: the operator reads
 * them through `/api/platform/applications/[id]/documents/[documentId]`, which
 * checks that the caller is a platform owner first.
 */

/** Roughly a phone photo of a certificate, with room to spare. */
const MAX_BYTES = 12 * 1024 * 1024;

/**
 * What a registration document plausibly is.
 *
 * Not a security boundary on its own — a content type is whatever the browser
 * says — but it stops the ordinary mistake of attaching a video, and nothing
 * here is ever executed or served as HTML.
 */
const ACCEPTED = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]);

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to continue your application.' }, { status: 401 });
  }

  const application = await applicationFor(session.email);
  if (!application) {
    return NextResponse.json({ error: 'No application to attach this to.' }, { status: 404 });
  }
  if (application.status !== 'draft') {
    return NextResponse.json(
      { error: 'This application has already been sent for review.' },
      { status: 409 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Malformed upload.' }, { status: 400 });
  }

  const documentId = String(form.get('documentId') ?? '');
  if (!(documentId in DOCUMENT_REQUIREMENTS)) {
    return NextResponse.json({ error: 'Unknown document type.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    // A zero-byte file is the usual sign of a picker that failed rather than a
    // deliberate upload, and it would sit in the queue looking attached.
    return NextResponse.json({ error: 'Choose a file to attach.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'That file is larger than 12 MB. Attach a smaller copy.' },
      { status: 413 },
    );
  }
  if (file.type && !ACCEPTED.has(file.type)) {
    return NextResponse.json(
      { error: 'Attach a PDF or a photo of the document.' },
      { status: 415 },
    );
  }

  /*
   * The stored name is generated, never taken from the upload.
   *
   * A filename arrives from the browser and can contain `..` or a leading
   * slash, which would write outside the folder entirely. The original is kept
   * as data — it is what the applicant and the reviewer recognise — and never
   * used to build a path.
   */
  const extension = extensionFor(file.name, file.type);
  const storedAs = path.posix.join(application.id, `${documentId}-${randomUUID()}${extension}`);
  const target = path.join(documentsRoot(), storedAs);

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));

  /*
   * Returned rather than saved onto the application here.
   *
   * The wizard holds the whole form and saves it as one document, so writing
   * the attachment separately would race with the next `save` and lose one of
   * the two. The client adds this to its state and the next save persists it.
   */
  return NextResponse.json({
    id: documentId as DocumentId,
    fileName: file.name,
    storedAs,
    byteSize: file.size,
    contentType: file.type || 'application/octet-stream',
    uploadedAtIso: new Date().toISOString(),
  });
}

/** A safe extension: from the declared type, or a known-good one on the name. */
function extensionFor(fileName: string, contentType: string): string {
  const byType: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'image/webp': '.webp',
  };
  if (byType[contentType]) return byType[contentType]!;

  const suffix = path.extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(suffix) ? suffix : '';
}
