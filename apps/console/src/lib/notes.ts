/**
 * Internal notes on a report, as `GET /org/incidents/{id}/notes` sends them.
 *
 * `author` is typed as "any object". The names a person is likely to be stored
 * under are read in order, and a note whose author cannot be named says
 * "A colleague" — never an id, which means nothing to the officer reading it.
 */

export interface InternalNote {
  id: string;
  body: string;
  authorName: string;
  createdAtIso: string | null;
}

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

function authorOf(author: unknown): string {
  if (typeof author === 'string' && author.trim() && !/^usr_/.test(author)) return author;
  if (!isRecord(author)) return 'A colleague';
  return (
    text(author.displayName) ??
    text(author.name) ??
    text(author.employeeName) ??
    text(author.email) ??
    'A colleague'
  );
}

export function normaliseNotes(raw: unknown): InternalNote[] {
  const items = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.items) ? raw.items : [];
  return items
    .filter(isRecord)
    .flatMap((note, index) => {
      const body = text(note.body);
      if (!body) return [];
      return [
        {
          id: text(note.id) ?? `note-${index}`,
          body,
          authorName: authorOf(note.author),
          createdAtIso: text(note.createdAt) ?? text(note.createdAtIso),
        },
      ];
    })
    // Oldest first: a thread is read in the order it was written.
    .sort((a, b) => (a.createdAtIso ?? '').localeCompare(b.createdAtIso ?? ''));
}
