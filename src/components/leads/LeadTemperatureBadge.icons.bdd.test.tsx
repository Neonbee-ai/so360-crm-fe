import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

/**
 * Feature: Hot / Warm / Cold badge icon (RE plan E §20).
 *
 * The shared lucide stub does not export Flame / Thermometer / Snowflake, so
 * the main spec exercises the "icon missing" fallback. This spec supplies the
 * icons to cover the "icon present" rendering.
 */
vi.mock('lucide-react', () => ({
  Flame: (p: any) => <svg data-testid="icon-Flame" {...p} />,
  Thermometer: (p: any) => <svg data-testid="icon-Thermometer" {...p} />,
  Snowflake: (p: any) => <svg data-testid="icon-Snowflake" {...p} />,
}));

import LeadTemperatureBadge from './LeadTemperatureBadge';

describe('Given the lucide icons are available', () => {
  describe.each([
    ['hot', 'icon-Flame'],
    ['warm', 'icon-Thermometer'],
    ['cold', 'icon-Snowflake'],
  ])('When a %s badge renders', (band, icon) => {
    it(`Then it shows the ${icon} icon`, () => {
      render(<LeadTemperatureBadge temperature={band} className="extra" />);
      const badge = screen.getByTestId('lead-temperature-badge');
      expect(badge.querySelector(`[data-testid="${icon}"]`)).not.toBeNull();
      expect(badge.className).toContain('extra');
    });
  });
});
