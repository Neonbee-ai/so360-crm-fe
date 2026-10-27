import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';

const shell = vi.hoisted(() => ({ value: {} as any }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => shell.value }));

import IcpFitCard, { ICP_FLAG } from './IcpFitCard';
import { fitBand } from '../../utils/icpFit';

const on = () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: (k: string) => k === 'submodule:crm:icp_manager' });
beforeEach(() => { shell.value = on(); });

describe('Feature: ICP fit card on lead detail', () => {
  it('Given a scored lead When rendered Then shows score, band, ICP name', () => {
    render(<IcpFitCard meta={{ icp_score: 72, icp_name: 'Enterprise CTOs', icp_criteria: { industry: 30 } }} />);
    expect(screen.getByText('ICP fit')).toBeTruthy();
    expect(screen.getByTestId('icp-fit-score').textContent).toBe('72 / 100');
    expect(screen.getByTestId('icp-fit-band').textContent).toBe('Good fit');
    expect(screen.getByTestId('icp-fit-name').textContent).toBe('Enterprise CTOs');
    expect(screen.getByText('Industry')).toBeTruthy();
  });

  it('Given points map When rendered Then positive is met and zero is missed', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: { industry: 30, location: 0 } }} />);
    expect(screen.getAllByTestId('icp-criterion-met')[0].textContent).toContain('✓');
    expect(screen.getAllByTestId('icp-criterion-missed')[0].textContent).toContain('✗');
  });

  it('Given an array criterion with no verdict When rendered Then shows ? unknown', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: [{ label: 'Title' }] }} />);
    expect(screen.getByTestId('icp-criterion-unknown').textContent).toContain('?');
  });

  it('Given a missed criterion with found value When rendered Then shows the found value', () => {
    render(<IcpFitCard meta={{ icp_score: 30, icp_criteria: [{ label: 'Location', matched: false, found: 'Berlin' }] }} />);
    expect(screen.getByTestId('icp-criterion-missed').textContent).toContain('Berlin');
  });

  it('Given no icp_score When rendered Then card is hidden', () => {
    render(<IcpFitCard meta={{ icp_criteria: { a: 1 } }} />);
    expect(screen.queryByTestId('icp-fit-card')).toBeNull();
  });

  it('Given the ICP flag is off When rendered Then card is hidden', () => {
    shell.value = { effectiveFlagsLoaded: true, isFeatureEnabled: () => false };
    render(<IcpFitCard meta={{ icp_score: 90 }} />);
    expect(screen.queryByTestId('icp-fit-card')).toBeNull();
  });

  it('Given synced_at When rendered Then footer shows Source: LinkedIn and date', () => {
    render(<IcpFitCard meta={{ icp_score: 90, synced_at: '2026-10-01T10:00:00.000Z' }} />);
    expect(screen.getByTestId('icp-fit-source').textContent).toBe('Source: LinkedIn · 1 Oct 2026');
  });

  it('Given no sync date When rendered Then footer is absent', () => {
    render(<IcpFitCard meta={{ icp_score: 90 }} />);
    expect(screen.queryByTestId('icp-fit-source')).toBeNull();
  });

  it.each([[100, 'excellent'], [80, 'excellent'], [79, 'good'], [60, 'good'], [59, 'fair'], [40, 'fair'], [39, 'not_a_fit'], [0, 'not_a_fit']])(
    'Given score %i When banded Then %s', (s, b) => { expect(fitBand(s as number)).toBe(b); });
});

const card = () => screen.queryByTestId('icp-fit-card');
const score = () => screen.getByTestId('icp-fit-score').textContent;

describe('Feature: ICP flag gating', () => {
  it('Given the flag constant When read Then it is submodule:crm:icp_manager', () => {
    expect(ICP_FLAG).toBe('submodule:crm:icp_manager');
  });

  it('Given the card When rendered Then it asks for exactly the ICP flag key', () => {
    const spy = vi.fn(() => true);
    shell.value = { effectiveFlagsLoaded: true, isFeatureEnabled: spy };
    render(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(spy).toHaveBeenCalledWith('submodule:crm:icp_manager');
  });

  it('Given only other flags are on When rendered Then card is hidden', () => {
    shell.value = { effectiveFlagsLoaded: true, isFeatureEnabled: (k: string) => k !== 'submodule:crm:icp_manager' };
    render(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(card()).toBeNull();
  });

  it('Given flags are still loading When rendered Then card is hidden even if flag reads on', () => {
    shell.value = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
    render(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(card()).toBeNull();
  });

  it('Given flags finish loading When re-rendered Then card appears', () => {
    shell.value = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
    const { rerender } = render(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(card()).toBeNull();
    shell.value = on();
    rerender(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(card()).not.toBeNull();
  });

  it('Given the flag is switched off When re-rendered Then card disappears', () => {
    const { rerender } = render(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(card()).not.toBeNull();
    shell.value = { effectiveFlagsLoaded: true, isFeatureEnabled: () => false };
    rerender(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(card()).toBeNull();
  });

  it('Given effectiveFlagsLoaded is undefined When flag reads on Then treated as loaded and shown', () => {
    shell.value = { isFeatureEnabled: () => true };
    render(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(card()).not.toBeNull();
  });

  it('Given the bridge has no isFeatureEnabled When rendered Then card is hidden', () => {
    shell.value = { effectiveFlagsLoaded: true };
    render(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(card()).toBeNull();
  });

  it('Given no shell bridge at all When rendered Then card is hidden and nothing throws', () => {
    shell.value = undefined;
    render(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(card()).toBeNull();
  });
});

describe('Feature: score parsing', () => {
  it.each([[undefined], [null]])('Given meta is %s When rendered Then card is hidden', (m) => {
    render(<IcpFitCard meta={m as any} />);
    expect(card()).toBeNull();
  });

  it('Given no meta prop When rendered Then card is hidden', () => {
    render(<IcpFitCard />);
    expect(card()).toBeNull();
  });

  it('Given an empty meta object When rendered Then card is hidden', () => {
    render(<IcpFitCard meta={{}} />);
    expect(card()).toBeNull();
  });

  it.each([['null', null], ['undefined', undefined], ['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity],
    ['empty string', ''], ['blank string', '   '], ['text', 'high'], ['boolean', true], ['object', { v: 1 }], ['array', [70]]])(
    'Given icp_score is %s When rendered Then card is hidden', (_n, v) => {
      render(<IcpFitCard meta={{ icp_score: v, icp_criteria: { a: 1 } }} />);
      expect(card()).toBeNull();
    });

  it('Given score 0 When rendered Then card shows 0 / 100 as Not a fit (0 is a valid score)', () => {
    render(<IcpFitCard meta={{ icp_score: 0 }} />);
    expect(score()).toBe('0 / 100');
    expect(screen.getByTestId('icp-fit-band').textContent).toBe('Not a fit');
  });

  it('Given a numeric string When rendered Then it is parsed', () => {
    render(<IcpFitCard meta={{ icp_score: '85' }} />);
    expect(score()).toBe('85 / 100');
    expect(screen.getByTestId('icp-fit-band').textContent).toBe('Excellent fit');
  });

  it('Given a padded numeric string When rendered Then it is parsed', () => {
    render(<IcpFitCard meta={{ icp_score: ' 61 ' }} />);
    expect(score()).toBe('61 / 100');
  });

  it('Given a decimal string When rendered Then it is parsed and rounded', () => {
    render(<IcpFitCard meta={{ icp_score: '72.6' }} />);
    expect(score()).toBe('73 / 100');
  });

  it.each([[72.4, '72 / 100'], [72.5, '73 / 100'], [72.6, '73 / 100'], [0.4, '0 / 100'], [-0.4, '0 / 100']])(
    'Given decimal score %s When rendered Then displays %s', (v, text) => {
      render(<IcpFitCard meta={{ icp_score: v }} />);
      expect(score()).toBe(text);
    });

  it('Given a negative score When rendered Then it is clamped to 0 / 100 as Not a fit', () => {
    render(<IcpFitCard meta={{ icp_score: -5 }} />);
    expect(score()).toBe('0 / 100');
    expect(screen.getByTestId('icp-fit-band').textContent).toBe('Not a fit');
  });

  it('Given a score above 100 When rendered Then it is clamped to 100 / 100 as Excellent', () => {
    render(<IcpFitCard meta={{ icp_score: 150 }} />);
    expect(score()).toBe('100 / 100');
    expect(screen.getByTestId('icp-fit-band').textContent).toBe('Excellent fit');
  });

  it('Given 59.5 When rendered Then displayed score and band agree (rounded before banding)', () => {
    render(<IcpFitCard meta={{ icp_score: 59.5 }} />);
    expect(score()).toBe('60 / 100');
    expect(screen.getByTestId('icp-fit-band').textContent).toBe('Good fit');
  });

  it('Given 79.4 When rendered Then it rounds down and stays Good fit', () => {
    render(<IcpFitCard meta={{ icp_score: 79.4 }} />);
    expect(score()).toBe('79 / 100');
    expect(screen.getByTestId('icp-fit-band').textContent).toBe('Good fit');
  });
});

describe('Feature: band rendering at every edge', () => {
  it.each([
    [0, 'Not a fit'], [39, 'Not a fit'], [40, 'Fair fit'], [59, 'Fair fit'],
    [60, 'Good fit'], [79, 'Good fit'], [80, 'Excellent fit'], [100, 'Excellent fit'],
  ])('Given score %i When rendered Then badge reads %s', (s, label) => {
    render(<IcpFitCard meta={{ icp_score: s }} />);
    expect(screen.getByTestId('icp-fit-band').textContent).toBe(label);
  });

  it.each([
    [90, 'success'], [70, 'info'], [50, 'warning'], [10, 'neutral'],
  ])('Given score %i When rendered Then badge uses the %s tone', (s, colour) => {
    render(<IcpFitCard meta={{ icp_score: s }} />);
    expect(screen.getByTestId('icp-fit-band').getAttribute('data-tone')).toBe(colour);
  });
});

describe('Feature: ICP name', () => {
  it('Given no icp_name When rendered Then name line is absent', () => {
    render(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(screen.queryByTestId('icp-fit-name')).toBeNull();
  });

  it.each([[''], [null], [undefined], [0]])('Given icp_name %s When rendered Then name line is absent', (n) => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_name: n }} />);
    expect(screen.queryByTestId('icp-fit-name')).toBeNull();
  });

  it('Given a non-string name When rendered Then it is stringified', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_name: 123 }} />);
    expect(screen.getByTestId('icp-fit-name').textContent).toBe('123');
  });

  it('Given a name with markup characters When rendered Then it is shown as text, not HTML', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_name: '<b>X</b>' }} />);
    expect(screen.getByTestId('icp-fit-name').textContent).toBe('<b>X</b>');
    expect(screen.getByTestId('icp-fit-name').querySelector('b')).toBeNull();
  });
});

describe('Feature: criteria list', () => {
  it('Given no icp_criteria When rendered Then list is absent', () => {
    render(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(screen.queryByTestId('icp-fit-criteria')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it.each([['empty map', {}], ['empty array', []], ['string', 'industry'], ['null', null], ['number', 3]])(
    'Given icp_criteria is %s When rendered Then list is absent but card shows', (_n, c) => {
      render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: c }} />);
      expect(card()).not.toBeNull();
      expect(screen.queryByTestId('icp-fit-criteria')).toBeNull();
    });

  it('Given a points map with mixed values When rendered Then each row has the right icon and label', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: { job_title: 20, location: 0, tech_stack: -3, size: 'big' } }} />);
    const items = within(screen.getByTestId('icp-fit-criteria')).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual(['✓Job Title', '✗Location', '✗Tech Stack', '?Size']);
  });

  it('Given a points map When rendered Then rows follow object order', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: { b: 1, a: 1 } }} />);
    expect(screen.getAllByRole('listitem').map((i) => i.textContent)).toEqual(['✓B', '✓A']);
  });

  it('Given an array with true/false/undefined matched When rendered Then icons are ✓ ✗ ?', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: [
      { label: 'Yes', matched: true }, { label: 'No', matched: false }, { label: 'Maybe' },
    ] }} />);
    expect(screen.getByTestId('icp-criterion-met').textContent).toBe('✓Yes');
    expect(screen.getByTestId('icp-criterion-missed').textContent).toBe('✗No');
    expect(screen.getByTestId('icp-criterion-unknown').textContent).toBe('?Maybe');
  });

  it('Given found values When rendered Then they follow an em dash after the label', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: [{ label: 'Industry', matched: true, found: 'SaaS' }] }} />);
    expect(screen.getByTestId('icp-criterion-met').textContent).toBe('✓Industry — SaaS');
  });

  it('Given found absent, null or empty When rendered Then no dash is shown', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: [
      { label: 'A', matched: true }, { label: 'B', matched: true, found: null }, { label: 'C', matched: true, found: '' },
    ] }} />);
    screen.getAllByRole('listitem').forEach((li) => expect(li.textContent).not.toContain('—'));
  });

  it('Given a numeric found value When rendered Then it is shown as text', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: [{ label: 'Employees', matched: true, found: 250 }] }} />);
    expect(screen.getByTestId('icp-criterion-met').textContent).toContain('— 250');
  });

  it('Given array items with only a field When rendered Then the field is humanised', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: [{ field: 'company_size', points: 4 }] }} />);
    expect(screen.getByText('Company Size')).toBeTruthy();
    expect(screen.getByTestId('icp-criterion-met')).toBeTruthy();
  });

  it('Given array items with neither label nor field When rendered Then a numbered fallback shows', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: [{ matched: true }] }} />);
    expect(screen.getByText('Criterion 1')).toBeTruthy();
  });

  it('Given null entries in the array When rendered Then rows render as unknown without throwing', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: [null, null] }} />);
    expect(screen.getAllByTestId('icp-criterion-unknown')).toHaveLength(2);
  });

  it('Given duplicate labels When rendered Then every row is rendered', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: [{ label: 'A', matched: true }, { label: 'A', matched: false }] }} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('Given a nested object value When rendered Then the row is unknown', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: { geo: { country: 'DE' } } }} />);
    expect(screen.getByTestId('icp-criterion-unknown').textContent).toBe('?Geo');
  });
});

describe('Feature: sync date footer', () => {
  it('Given last_synced_at When rendered Then footer shows it', () => {
    render(<IcpFitCard meta={{ icp_score: 50, last_synced_at: '2026-03-05T00:00:00Z' }} />);
    expect(screen.getByTestId('icp-fit-source').textContent).toBe('Source: LinkedIn · 5 Mar 2026');
  });

  it('Given both dates When rendered Then last_synced_at wins over synced_at', () => {
    render(<IcpFitCard meta={{ icp_score: 50, last_synced_at: '2026-03-05T00:00:00Z', synced_at: '2025-01-01T00:00:00Z' }} />);
    expect(screen.getByTestId('icp-fit-source').textContent).toContain('5 Mar 2026');
  });

  it('Given only synced_at When rendered Then it is used', () => {
    render(<IcpFitCard meta={{ icp_score: 50, synced_at: '2025-12-31T23:59:00Z' }} />);
    expect(screen.getByTestId('icp-fit-source').textContent).toContain('31 Dec 2025');
  });

  it('Given a late-evening UTC time When rendered Then the date is formatted in UTC, not local time', () => {
    render(<IcpFitCard meta={{ icp_score: 50, synced_at: '2026-10-01T23:30:00Z' }} />);
    expect(screen.getByTestId('icp-fit-source').textContent).toContain('1 Oct 2026');
  });

  it('Given an invalid date string When rendered Then footer is absent', () => {
    render(<IcpFitCard meta={{ icp_score: 50, synced_at: 'not-a-date' }} />);
    expect(screen.queryByTestId('icp-fit-source')).toBeNull();
  });

  it('Given an invalid last_synced_at and valid synced_at When rendered Then footer falls back to synced_at', () => {
    render(<IcpFitCard meta={{ icp_score: 50, last_synced_at: 'garbage', synced_at: '2026-10-01T10:00:00Z' }} />);
    expect(screen.getByTestId('icp-fit-source').textContent).toContain('1 Oct 2026');
  });

  it('Given an empty last_synced_at and valid synced_at When rendered Then footer uses synced_at', () => {
    render(<IcpFitCard meta={{ icp_score: 50, last_synced_at: '', synced_at: '2026-10-01T10:00:00Z' }} />);
    expect(screen.getByTestId('icp-fit-source').textContent).toContain('1 Oct 2026');
  });

  it.each([[''], [null], [undefined], [12345], [{}]])('Given a non-string or empty date %s When rendered Then footer is absent', (d) => {
    render(<IcpFitCard meta={{ icp_score: 50, synced_at: d }} />);
    expect(screen.queryByTestId('icp-fit-source')).toBeNull();
  });
});

describe('Feature: accessibility and structure', () => {
  it('Given a scored lead When rendered Then there is a level-3 heading "ICP fit"', () => {
    render(<IcpFitCard meta={{ icp_score: 50 }} />);
    expect(screen.getByRole('heading', { level: 3, name: 'ICP fit' })).toBeTruthy();
  });

  it('Given criteria When rendered Then they are exposed as a list of listitems', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: { a: 1, b: 0 } }} />);
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('Given criteria states When rendered Then icons carry aria-labels met, missed, unknown', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: [{ label: 'A', matched: true }, { label: 'B', matched: false }, { label: 'C' }] }} />);
    expect(screen.getByLabelText('met').textContent).toBe('✓');
    expect(screen.getByLabelText('missed').textContent).toBe('✗');
    expect(screen.getByLabelText('unknown').textContent).toBe('?');
  });

  it('Given a rendered card Then the root wraps a Comb card section containing every part', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_name: 'N', icp_criteria: { a: 1 }, synced_at: '2026-10-01T10:00:00Z' }} />);
    const root = screen.getByTestId('icp-fit-card');
    expect(root.querySelector('section')).not.toBeNull();
    ['icp-fit-band', 'icp-fit-score', 'icp-fit-name', 'icp-fit-criteria', 'icp-fit-source'].forEach((id) =>
      expect(within(root).getByTestId(id)).toBeTruthy());
  });

  it('Given a hidden card Then nothing at all is in the container', () => {
    const { container } = render(<IcpFitCard meta={{}} />);
    expect(container.innerHTML).toBe('');
  });
});
