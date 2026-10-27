import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('@so360/event-bus', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn(() => () => {}) },
}));

let mockBridge: any = {};
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => mockBridge,
}));

import { eventBus } from '@so360/event-bus';
import { ClickToCallButton } from './ClickToCallButton';

describe('Feature ClickToCallButton renders as Comb IconButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBridge = { getFeatureState: vi.fn(() => 'enabled'), isModuleEnabled: vi.fn(() => true) };
  });

  describe('Scenario render', () => {
    it('Given a number When rendered Then it is a Comb icon-button, size sm, labelled Call <n>', () => {
      render(<ClickToCallButton number="+971501234567" entityType="lead" />);
      const btn = screen.getByRole('button', { name: 'Call +971501234567' });
      expect(btn).toHaveAttribute('data-comb', 'icon-button');
      expect(btn).toHaveAttribute('data-size', 'sm');
      expect(btn).toHaveAttribute('title', 'Call +971501234567');
      expect(btn).toHaveAttribute('type', 'button');
      expect(btn.querySelector('svg')).not.toBeNull();
    });

    it('Given a padded number When rendered Then label uses the trimmed number', () => {
      render(<ClickToCallButton number="  +1555  " entityType="lead" />);
      expect(screen.getByRole('button', { name: 'Call +1555' })).toBeInTheDocument();
    });

    it('Given a className When rendered Then the success token colour and className are applied', () => {
      render(<ClickToCallButton number="123" entityType="lead" className="extra-x" />);
      const btn = screen.getByRole('button', { name: 'Call 123' });
      expect(btn.className).toContain('text-success');
      expect(btn.className).toContain('extra-x');
    });

    it('Given a custom size When rendered Then the icon uses that size', () => {
      render(<ClickToCallButton number="123" entityType="lead" size={20} />);
      const svg = screen.getByRole('button', { name: 'Call 123' }).querySelector('svg')!;
      expect(svg.getAttribute('size')).toBe('20');
    });
  });

  describe('Scenario interaction', () => {
    it('Given the button When clicked Then it publishes VOICE_CALL_REQUEST with trimmed number and entity', () => {
      render(<ClickToCallButton number=" 999 " entityType="deal" entityId="d1" name="Big" />);
      fireEvent.click(screen.getByRole('button', { name: 'Call 999' }));
      expect(eventBus.publish).toHaveBeenCalledWith('VOICE_CALL_REQUEST', {
        number: '999', entityType: 'deal', entityId: 'd1', name: 'Big',
      });
    });

    it('Given the button focused When Enter is pressed Then it publishes once', async () => {
      const user = userEvent.setup();
      render(<ClickToCallButton number="555" entityType="lead" />);
      screen.getByRole('button', { name: 'Call 555' }).focus();
      await user.keyboard('{Enter}');
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('Given the button focused When Space is pressed Then it publishes once', async () => {
      const user = userEvent.setup();
      render(<ClickToCallButton number="555" entityType="lead" />);
      screen.getByRole('button', { name: 'Call 555' }).focus();
      await user.keyboard(' ');
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('Given a link wrapper When clicked Then default navigation is prevented and the row does not receive click', () => {
      const rowClick = vi.fn();
      render(
        <div onClick={rowClick}>
          <ClickToCallButton number="555" entityType="lead" />
        </div>,
      );
      const notPrevented = fireEvent.click(screen.getByRole('button', { name: 'Call 555' }));
      expect(notPrevented).toBe(false);
      expect(rowClick).not.toHaveBeenCalled();
    });

    it('Given two buttons When Tab is pressed Then focus moves from the first to the second', async () => {
      const user = userEvent.setup();
      render(
        <>
          <ClickToCallButton number="111" entityType="lead" />
          <ClickToCallButton number="222" entityType="lead" />
        </>,
      );
      await user.tab();
      expect(screen.getByRole('button', { name: 'Call 111' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Call 222' })).toHaveFocus();
    });
  });

  describe('Scenario error path', () => {
    it('Given the event bus throws When clicked Then the error surfaces from the handler without crashing the render', () => {
      (eventBus.publish as any).mockImplementationOnce(() => { throw new Error('bus down'); });
      render(<ClickToCallButton number="555" entityType="lead" />);
      // React reports handler errors asynchronously via window error; swallow it.
      const onErr = vi.fn((e: ErrorEvent) => e.preventDefault());
      window.addEventListener('error', onErr);
      fireEvent.click(screen.getByRole('button', { name: 'Call 555' }));
      window.removeEventListener('error', onErr);
      expect(screen.getByRole('button', { name: 'Call 555' })).toBeInTheDocument();
    });
  });

  describe('Scenario empty or gated', () => {
    it.each([[''], ['   '], [null], [undefined]])('Given number %j When rendered Then nothing renders', (n) => {
      const { container } = render(<ClickToCallButton number={n as any} entityType="lead" />);
      expect(container).toBeEmptyDOMElement();
    });

    it.each(['hidden', 'disabled', 'locked'])('Given flag state %s When rendered Then nothing renders', (state) => {
      mockBridge.getFeatureState = vi.fn(() => state);
      const { container } = render(<ClickToCallButton number="555" entityType="lead" />);
      expect(container).toBeEmptyDOMElement();
    });

    it('Given the Inbox module is disabled When rendered Then nothing renders', () => {
      mockBridge.isModuleEnabled = vi.fn(() => false);
      const { container } = render(<ClickToCallButton number="555" entityType="lead" />);
      expect(container).toBeEmptyDOMElement();
      expect(mockBridge.isModuleEnabled).toHaveBeenCalledWith('inbox');
    });

    it('Given no bridge capabilities When rendered Then it fails open and renders', () => {
      mockBridge = {};
      render(<ClickToCallButton number="555" entityType="lead" />);
      expect(screen.getByRole('button', { name: 'Call 555' })).toBeInTheDocument();
    });

    it('Given a null bridge When rendered Then it fails open and renders', () => {
      mockBridge = null;
      render(<ClickToCallButton number="555" entityType="lead" />);
      expect(screen.getByRole('button', { name: 'Call 555' })).toBeInTheDocument();
    });
  });
});
