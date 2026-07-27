import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@so360/event-bus', () => ({
  eventBus: {
    publish: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}));

// Mutable bridge — each test shapes what the shell reports.
let mockBridge: any = {};
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => mockBridge,
}));

import { eventBus } from '@so360/event-bus';
import { ClickToCallButton, VOICE_CALLING_FLAG } from './ClickToCallButton';

describe('ClickToCallButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBridge = {
      getFeatureState: vi.fn(() => 'enabled'),
      isModuleEnabled: vi.fn(() => true),
    };
  });

  describe('Given a phone number and the voice-calling flag is enabled', () => {
    it('When rendered / Then shows a call button with an accessible label', () => {
      render(<ClickToCallButton number="+971501234567" entityType="lead" entityId="lead-1" name="John Doe" />);
      const btn = screen.getByRole('button', { name: 'Call +971501234567' });
      expect(btn).toBeInTheDocument();
      expect(mockBridge.getFeatureState).toHaveBeenCalledWith(VOICE_CALLING_FLAG);
    });

    it('When clicked / Then publishes VOICE_CALL_REQUEST with the full payload', () => {
      render(<ClickToCallButton number="+971501234567" entityType="contact" entityId="c-42" name="Jane" />);
      fireEvent.click(screen.getByRole('button', { name: 'Call +971501234567' }));
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledWith('VOICE_CALL_REQUEST', {
        number: '+971501234567',
        entityType: 'contact',
        entityId: 'c-42',
        name: 'Jane',
      });
    });

    it('When clicked inside a clickable row / Then stops propagation so the row does not navigate', () => {
      const onRowClick = vi.fn();
      render(
        <div onClick={onRowClick}>
          <ClickToCallButton number="+15550001111" entityType="deal" entityId="d-1" name="Big Deal" />
        </div>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Call +15550001111' }));
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(onRowClick).not.toHaveBeenCalled();
    });
  });

  describe('Given no phone number', () => {
    it('When number is undefined / Then renders nothing', () => {
      const { container } = render(<ClickToCallButton entityType="lead" />);
      expect(container.firstChild).toBeNull();
    });

    it('When number is empty/whitespace / Then renders nothing', () => {
      const { container } = render(<ClickToCallButton number="   " entityType="company" entityId="p-1" />);
      expect(container.firstChild).toBeNull();
    });

    it('When number is null / Then renders nothing', () => {
      const { container } = render(<ClickToCallButton number={null} entityType="contact" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Given the voice-calling flag is gated off', () => {
    it('When flag state is hidden / Then renders nothing', () => {
      mockBridge.getFeatureState = vi.fn(() => 'hidden');
      const { container } = render(<ClickToCallButton number="+15550001111" entityType="lead" entityId="l-1" />);
      expect(container.firstChild).toBeNull();
    });

    it('When flag state is disabled / Then renders nothing', () => {
      mockBridge.getFeatureState = vi.fn(() => 'disabled');
      const { container } = render(<ClickToCallButton number="+15550001111" entityType="lead" entityId="l-1" />);
      expect(container.firstChild).toBeNull();
    });

    it('When flag state is locked / Then renders nothing', () => {
      mockBridge.getFeatureState = vi.fn(() => 'locked');
      const { container } = render(<ClickToCallButton number="+15550001111" entityType="lead" entityId="l-1" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Given the Inbox module is disabled for the org', () => {
    it('When isModuleEnabled("inbox") is false / Then renders nothing', () => {
      mockBridge.isModuleEnabled = vi.fn((m: string) => m !== 'inbox');
      const { container } = render(<ClickToCallButton number="+15550001111" entityType="deal" entityId="d-1" />);
      expect(container.firstChild).toBeNull();
      expect(mockBridge.isModuleEnabled).toHaveBeenCalledWith('inbox');
    });
  });

  describe('Given the shell bridge lacks gating capabilities (fail-open)', () => {
    it('When the bridge has no getFeatureState/isModuleEnabled / Then still renders the button', () => {
      mockBridge = {};
      render(<ClickToCallButton number="+15550001111" entityType="lead" entityId="l-1" />);
      expect(screen.getByRole('button', { name: 'Call +15550001111' })).toBeInTheDocument();
    });

    it('When the bridge is null / Then still renders the button', () => {
      mockBridge = null;
      render(<ClickToCallButton number="+15550001111" entityType="lead" entityId="l-1" />);
      expect(screen.getByRole('button', { name: 'Call +15550001111' })).toBeInTheDocument();
    });
  });
});
