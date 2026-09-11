import fs from 'fs';
import os from 'os';
import path from 'path';
import { COUNT_RANGE, DWELL_SECONDS_RANGE, readTopStories, writeTopStories } from '../topStories';

/**
 * The rhythm of the front page, and who decides it.
 *
 * The mobile feed no longer has one lead: several stories share the top slot and
 * take turns. How many, and how long each holds, is an editorial judgement — a
 * busy news day wants more stories moving faster — so it is a control on the
 * platform desk rather than a constant compiled into an app nobody can change
 * without a release.
 *
 * Every bound below is a typo somebody will make in an admin field, and every
 * one of them reaches a reader if it is not caught here.
 */

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawuro-top-'));
  process.env.DAWURO_TOP_STORIES_FILE = path.join(dir, 'top-stories.json');
});

test('an untouched platform answers with what the app already does', () => {
  /*
   * A missing file is the ordinary state before anybody has opened this page.
   * Answering with the app's own defaults means the form opens showing the
   * truth, rather than an empty field an operator fills in to no effect.
   */
  return expect(readTopStories()).resolves.toMatchObject({ count: 5, dwellMs: 6000 });
});

test('a setting survives being written and read back', async () => {
  await writeTopStories({
    count: 3,
    dwellSeconds: 8,
    byEmail: 'owner@dawuro.local',
    atIso: '2026-09-11T10:00:00.000Z',
  });

  const after = await readTopStories();
  expect(after.count).toBe(3);
  // Entered in seconds, stored in milliseconds. Nobody types 6000.
  expect(after.dwellMs).toBe(8000);
});

test('who changed it is recorded', async () => {
  // A rotation nobody remembers setting should have a name and a time on it.
  await writeTopStories({
    count: 4,
    dwellSeconds: 5,
    byEmail: 'owner@dawuro.local',
    atIso: '2026-09-11T10:00:00.000Z',
  });
  const after = await readTopStories();
  expect(after.updatedByEmail).toBe('owner@dawuro.local');
  expect(after.updatedAtIso).toBe('2026-09-11T10:00:00.000Z');
});

describe('a typo cannot reach a reader', () => {
  const save = (count: number, dwellSeconds: number) =>
    writeTopStories({ count, dwellSeconds, byEmail: 'o@d.local', atIso: '2026-09-11T10:00:00Z' });

  test('zero stories does not empty the top of the feed', async () => {
    expect((await save(0, 6)).count).toBe(COUNT_RANGE.min);
  });

  test('a strobe is clamped to something readable', async () => {
    // Below three seconds a four-line headline cannot be finished, and the
    // rotation stops being a lead and becomes a flicker.
    expect((await save(5, 1)).dwellMs).toBe(DWELL_SECONDS_RANGE.min * 1000);
  });

  test('a carousel that never moves is clamped too', async () => {
    // Above twenty seconds a reader assumes it is stuck, which is worse than a
    // rotation that is merely fast.
    expect((await save(5, 600)).dwellMs).toBe(DWELL_SECONDS_RANGE.max * 1000);
  });

  test('a value that is not a number falls back rather than becoming NaN', async () => {
    /*
     * `setTimeout(fn, NaN)` fires immediately — the strobe again, by the one
     * route a range check alone would miss.
     */
    const saved = await writeTopStories({
      count: Number('nonsense'),
      dwellSeconds: Number.POSITIVE_INFINITY,
      byEmail: 'o@d.local',
      atIso: '2026-09-11T10:00:00Z',
    });
    expect(saved.count).toBe(5);
    // Infinity is not a number that is merely too large — it is not a number at
    // all, so it falls back to the default rather than being clamped to the
    // ceiling. A reader gets the app's own rhythm, not the slowest allowed one.
    expect(saved.dwellMs).toBe(6000);
  });
});

test('an unreadable store is a fault, not a silent default', async () => {
  /*
   * Answering with defaults over a saved setting would have an operator
   * re-entering a value that was already there, and never learning why.
   */
  fs.writeFileSync(process.env.DAWURO_TOP_STORIES_FILE!, 'not json at all', 'utf8');
  await expect(readTopStories()).rejects.toThrow();
});

test('the bounds match the ones the app enforces', () => {
  /*
   * Hand-synced with `topStorySettings.ts` in the mobile app, which clamps
   * anything it is served to the same range — two copies because the phone does
   * not consume this package. They disagreeing would show as a desk offering a
   * value the app silently refuses to honour, which is invisible from here.
   */
  expect(COUNT_RANGE).toEqual({ min: 1, max: 10 });
  expect(DWELL_SECONDS_RANGE).toEqual({ min: 3, max: 20 });
});
