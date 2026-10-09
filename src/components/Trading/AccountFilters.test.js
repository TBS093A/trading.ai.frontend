import { filtersToForm, formToFilters, EMPTY_FILTERS } from './AccountFilters';

test('empty selections are sent as "no filter"', () => {
  expect(formToFilters(EMPTY_FILTERS)).toEqual({});
  expect(formToFilters({ asset_ids: [1, 2], intervals: [], patterns: ['bat'], direction: '' }))
    .toEqual({ asset_ids: [1, 2], patterns: ['bat'] });
  expect(formToFilters({ asset_ids: [], intervals: ['4h'], patterns: [], direction: 'short' }))
    .toEqual({ intervals: ['4h'], direction: 'short' });
});

test('account filters_json maps back to the form, missing = nothing selected', () => {
  expect(filtersToForm(undefined)).toEqual(EMPTY_FILTERS);
  expect(filtersToForm({ intervals: ['1h'], direction: 'long' }))
    .toEqual({ asset_ids: [], intervals: ['1h'], patterns: [], direction: 'long' });
});
