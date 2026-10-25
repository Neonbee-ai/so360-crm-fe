import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import LeadTemperatureBadge, {
  LEAD_TEMPERATURE_OPTIONS,
  matchesTemperatureFilter,
  normaliseTemperature,
} from './LeadTemperatureBadge';
import LeadCardList from './LeadCardList';
import type { Lead } from '../../types/crm';

/**
 * Feature: Hot / Warm / Cold lead temperature (RE plan E §20).
 *
 * crm-be computes and stores the band; the UI only reads it. The badge and
 * the list filter are shown only when `submodule:crm:re_lead_temperature`
 * is on (the page passes `showTemperature`).
 */

const makeLead = (over: Partial<Lead> = {}): Lead =>
  ({
    id: 'l1',
    company_name: 'Acme Corp',
    contact_name: 'Jane Doe',
    status: 'New',
    auto_score: 72,
    created_at: '2026-01-01T00:00:00Z',
    activities: [],
    notes: [],
    ...(over as object),
  } as Lead);

describe('Given a stored temperature value', () => {
  it('When it is a known band in any case or padding, Then it is normalised', () => {
    expect(normaliseTemperature('hot')).toBe('hot');
    expect(normaliseTemperature(' WARM ')).toBe('warm');
    expect(normaliseTemperature('Cold')).toBe('cold');
  });

  it('When it is unknown, empty or not a string, Then there is no band', () => {
    expect(normaliseTemperature('boiling')).toBeNull();
    expect(normaliseTemperature('')).toBeNull();
    expect(normaliseTemperature(null)).toBeNull();
    expect(normaliseTemperature(undefined)).toBeNull();
    expect(normaliseTemperature(70)).toBeNull();
  });

  it('When the filter options are listed, Then they are Hot, Warm and Cold in that order', () => {
    expect(LEAD_TEMPERATURE_OPTIONS.map((o) => o.value)).toEqual(['hot', 'warm', 'cold']);
    expect(LEAD_TEMPERATURE_OPTIONS.map((o) => o.label)).toEqual(['Hot', 'Warm', 'Cold']);
  });
});

describe('Given the lead list temperature filter', () => {
  it('When the filter is All or unset (older saved view), Then every lead is kept', () => {
    expect(matchesTemperatureFilter({ temperature: 'cold' }, 'All')).toBe(true);
    expect(matchesTemperatureFilter({ temperature: null }, undefined)).toBe(true);
    expect(matchesTemperatureFilter({ temperature: undefined }, '')).toBe(true);
  });

  it('When a band is chosen, Then only leads with that stored band match', () => {
    expect(matchesTemperatureFilter({ temperature: 'hot' }, 'hot')).toBe(true);
    expect(matchesTemperatureFilter({ temperature: 'warm' }, 'hot')).toBe(false);
  });

  it('When a lead has no band yet, Then it is excluded from a banded filter', () => {
    expect(matchesTemperatureFilter({ temperature: null }, 'cold')).toBe(false);
    expect(matchesTemperatureFilter({ temperature: undefined }, 'warm')).toBe(false);
  });
});

describe('Given the temperature badge', () => {
  it.each([
    ['hot', 'Hot'],
    ['warm', 'Warm'],
    ['cold', 'Cold'],
  ])('When the band is %s, Then it reads %s', (band, label) => {
    render(<LeadTemperatureBadge temperature={band} />);
    const badge = screen.getByTestId('lead-temperature-badge');
    expect(badge).toHaveAttribute('data-temperature', band);
    expect(badge).toHaveTextContent(label);
    expect(badge).toHaveAttribute('title', `${label} lead`);
  });

  it('When a score is known, Then the tooltip carries it out of 100', () => {
    render(<LeadTemperatureBadge temperature="hot" score={82} />);
    expect(screen.getByTestId('lead-temperature-badge')).toHaveAttribute('title', 'Hot lead — temperature 82/100');
  });

  it('When there is no band, Then nothing is rendered', () => {
    const { container } = render(<LeadTemperatureBadge temperature={null} score={50} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Given the mobile lead cards', () => {
  const renderCards = (showTemperature?: boolean) =>
    render(
      <LeadCardList
        leads={[makeLead({ temperature: 'hot', temperature_score: 88 }), makeLead({ id: 'l2', temperature: null })]}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onRowClick={vi.fn()}
        showTemperature={showTemperature}
      />,
    );

  it('When temperature is on, Then a banded lead shows its badge and an unbanded one shows none', () => {
    renderCards(true);
    expect(within(screen.getByTestId('lead-card-l1')).getByTestId('lead-temperature-badge')).toHaveAttribute('data-temperature', 'hot');
    expect(within(screen.getByTestId('lead-card-l2')).queryByTestId('lead-temperature-badge')).toBeNull();
  });

  it('When temperature is off (flag off / default), Then no badge is shown', () => {
    renderCards();
    expect(screen.queryByTestId('lead-temperature-badge')).toBeNull();
  });
});
