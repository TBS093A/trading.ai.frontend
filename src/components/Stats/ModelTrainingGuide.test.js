import { nextWeeklyFit } from './ModelTrainingGuide';

test('next weekly fit is the coming Sunday 04:00 UTC', () => {
  // Friday
  expect(nextWeeklyFit(new Date('2026-10-09T12:00:00Z')).toISOString()).toBe('2026-10-11T04:00:00.000Z');
  // Sunday before 04:00 -> same day
  expect(nextWeeklyFit(new Date('2026-10-11T03:59:00Z')).toISOString()).toBe('2026-10-11T04:00:00.000Z');
  // Sunday right after -> next week
  expect(nextWeeklyFit(new Date('2026-10-11T04:00:00Z')).toISOString()).toBe('2026-10-18T04:00:00.000Z');
});
