import { COUNT_RANGE, DWELL_SECONDS_RANGE, readTopStories, writeTopStories } from '../topStories';
import { apiRequest } from '../api';

jest.mock('../api', () => ({ apiRequest: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

/**
 * The rhythm of the front page, and who decides it.
 *
 * The mobile feed no longer has one lead: several stories share the top slot and
 * take turns. How many, and how long each holds, is an editorial judgement — a
 * busy news day wants more stories moving faster — so it is a control on the
 * platform desk, saved to the service and served to every phone.
 *
 * Every bound below is a typo somebody will make in an admin field, and every
 * one of them reaches a reader if it is not caught.
 */

beforeEach(() => {
  request.mockReset();
});

const save = (count: number, dwellSeconds: number) =>
  writeTopStories({
    count,
    dwellSeconds,
    byEmail: 'owner@dawuro.local',
    atIso: '2026-09-14T10:00:00.000Z',
    token: 'tok',
  });

test('what phones are served is what the page shows', async () => {
  request.mockResolvedValue({ feed: { topStoryCount: 3, topStoryDwellMs: 8000 } });
  await expect(readTopStories()).resolves.toMatchObject({ count: 3, dwellMs: 8000 });
  // The public read: every phone uses the same one.
  expect(request).toHaveBeenCalledWith('/settings', {});
});

test('a service with no feed settings answers with what the app already does', async () => {
  request.mockResolvedValue({});
  await expect(readTopStories()).resolves.toMatchObject({ count: 5, dwellMs: 6000 });
});

test('an unreachable service is an outage, not a silent default', async () => {
  /*
   * Answering with defaults over a live setting would have an operator
   * re-entering a value that was already there, and never learning why.
   */
  request.mockRejectedValue(new Error('down'));
  await expect(readTopStories()).rejects.toThrow();
});

test('a save goes to the service, with the owner token, in milliseconds', async () => {
  request.mockResolvedValue({ feed: { topStoryCount: 4, topStoryDwellMs: 9000 } });
  const saved = await save(4, 9);

  expect(request).toHaveBeenCalledWith('/platform/settings', {
    method: 'PUT',
    token: 'tok',
    body: { feed: { topStoryCount: 4, topStoryDwellMs: 9000 } },
  });
  expect(saved).toMatchObject({ count: 4, dwellMs: 9000 });
  expect(saved.updatedByEmail).toBe('owner@dawuro.local');
});

test("the service's stored value wins over what was sent", async () => {
  // If it clamps differently, the form should show what is live, not our guess.
  request.mockResolvedValue({ feed: { topStoryCount: 2, topStoryDwellMs: 5000 } });
  expect(await save(4, 9)).toMatchObject({ count: 2, dwellMs: 5000 });
});

describe('a typo cannot reach a reader', () => {
  // The service answers with nothing, so the clamped request is what comes back.
  beforeEach(() => request.mockResolvedValue({}));

  test('zero stories does not empty the top of the feed', async () => {
    expect((await save(0, 6)).count).toBe(COUNT_RANGE.min);
  });

  test('a strobe is clamped to something readable', async () => {
    expect((await save(5, 1)).dwellMs).toBe(DWELL_SECONDS_RANGE.min * 1000);
  });

  test('a carousel that never moves is clamped too', async () => {
    expect((await save(5, 600)).dwellMs).toBe(DWELL_SECONDS_RANGE.max * 1000);
  });

  test('a value that is not a number falls back rather than becoming NaN', async () => {
    // `setTimeout(fn, NaN)` fires immediately — the strobe again, by another route.
    const saved = await save(Number('nonsense'), Number.POSITIVE_INFINITY);
    expect(saved.count).toBe(5);
    expect(saved.dwellMs).toBe(6000);
  });
});

test('the bounds match the ones the service and the app enforce', () => {
  expect(COUNT_RANGE).toEqual({ min: 1, max: 5 });
  expect(DWELL_SECONDS_RANGE).toEqual({ min: 3, max: 20 });
});
