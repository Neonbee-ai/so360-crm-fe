import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import NoteMentionPicker from './NoteMentionPicker';

const people: any[] = [
  { id: 'u1', full_name: 'Alice Ray', email: 'alice@x.com' },
  { id: 'u2', full_name: 'Bob Stone', email: 'bob@x.com' },
  { id: 'u3', full_name: '', email: 'carol@x.com' },
];

const setup = (over: Partial<React.ComponentProps<typeof NoteMentionPicker>> = {}) => {
  const onPick = vi.fn(); const onClose = vi.fn();
  const utils = render(<NoteMentionPicker query="" people={people} onPick={onPick} onClose={onClose} {...over} />);
  return { onPick, onClose, ...utils };
};
const key = (k: string) => fireEvent.keyDown(window, { key: k });

describe('Feature NoteMentionPicker options are Comb ghost Buttons', () => {
  describe('Scenario render', () => {
    it('Given people When rendered Then a listbox holds one option per person as Comb ghost buttons', () => {
      setup();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      const opts = screen.getAllByRole('option');
      expect(opts).toHaveLength(3);
      opts.forEach((o) => {
        expect(o).toHaveAttribute('data-comb', 'button');
        expect(o).toHaveAttribute('data-variant', 'ghost');
        expect(o).toHaveAttribute('type', 'button');
      });
    });

    it('Given a person without a name When rendered Then email is label and initial is uppercase', () => {
      setup();
      const opt = screen.getByRole('option', { name: /carol@x.com/ });
      expect(opt).toHaveTextContent('C');
    });

    it('Given a name When rendered Then it shows initial avatar and name', () => {
      setup();
      expect(screen.getByRole('option', { name: /Alice Ray/ })).toHaveTextContent('A');
    });

    it('Given more than 8 matches When rendered Then only 8 options show', () => {
      const many = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, full_name: `Person ${i}`, email: `p${i}@x.com` }));
      setup({ people: many as any });
      expect(screen.getAllByRole('option')).toHaveLength(8);
    });
  });

  describe('Scenario filter and empty', () => {
    it('Given a query When rendered Then only matching people show, case-insensitive', () => {
      setup({ query: 'BOB' });
      expect(screen.getAllByRole('option')).toHaveLength(1);
      expect(screen.getByRole('option', { name: /Bob Stone/ })).toBeInTheDocument();
    });

    it('Given a query matching email When rendered Then the person with no name matches', () => {
      setup({ query: 'carol' });
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    it('Given no matches When rendered Then nothing renders', () => {
      const { container } = setup({ query: 'zzz' });
      expect(container).toBeEmptyDOMElement();
    });

    it('Given empty people When rendered Then nothing renders', () => {
      const { container } = setup({ people: [] });
      expect(container).toBeEmptyDOMElement();
    });

    it('Given no candidates When Enter is pressed Then onPick is not called', () => {
      const { onPick } = setup({ query: 'zzz' });
      key('Enter');
      expect(onPick).not.toHaveBeenCalled();
    });
  });

  describe('Scenario highlight state', () => {
    it('Given the picker When rendered Then the first option is selected', () => {
      setup();
      const opts = screen.getAllByRole('option');
      expect(opts[0]).toHaveAttribute('aria-selected', 'true');
      expect(opts[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('Given the first option When ArrowDown is pressed Then selection moves to the second', () => {
      setup();
      key('ArrowDown');
      const opts = screen.getAllByRole('option');
      expect(opts[1]).toHaveAttribute('aria-selected', 'true');
      expect(opts[0]).toHaveAttribute('aria-selected', 'false');
    });

    it('Given the last option When ArrowDown is pressed Then selection stays on the last', () => {
      setup();
      key('ArrowDown'); key('ArrowDown'); key('ArrowDown'); key('ArrowDown');
      expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
    });

    it('Given the second option When ArrowUp is pressed Then selection returns to the first', () => {
      setup();
      key('ArrowDown'); key('ArrowUp');
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('Given the first option When ArrowUp is pressed Then selection stays on the first', () => {
      setup();
      key('ArrowUp');
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('Given the pointer When it enters the third option Then it becomes selected', () => {
      setup();
      fireEvent.mouseEnter(screen.getAllByRole('option')[2]);
      expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'false');
    });

    it('Given a selection on the second When the query changes Then the highlight resets to the first', () => {
      const { rerender, onPick, onClose } = setup();
      key('ArrowDown');
      rerender(<NoteMentionPicker query="a" people={people} onPick={onPick} onClose={onClose} />);
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('Given the highlighted option When rendered Then it carries the primary token class', () => {
      setup();
      expect(screen.getAllByRole('option')[0].className).toContain('!text-primary');
      expect(screen.getAllByRole('option')[1].className).toContain('!text-fg');
    });
  });

  describe('Scenario interaction', () => {
    it('Given an option When clicked Then onPick receives id and display name', () => {
      const { onPick } = setup();
      fireEvent.click(screen.getByRole('option', { name: /Bob Stone/ }));
      expect(onPick).toHaveBeenCalledWith('u2', 'Bob Stone');
    });

    it('Given a nameless person When clicked Then onPick receives the email', () => {
      const { onPick } = setup();
      fireEvent.click(screen.getByRole('option', { name: /carol@x.com/ }));
      expect(onPick).toHaveBeenCalledWith('u3', 'carol@x.com');
    });

    it('Given the highlight on the first When Enter is pressed Then onPick gets that person', () => {
      const { onPick } = setup();
      key('Enter');
      expect(onPick).toHaveBeenCalledWith('u1', 'Alice Ray');
    });

    it('Given ArrowDown then Enter When pressed Then onPick gets the second person', () => {
      const { onPick } = setup();
      key('ArrowDown'); key('Enter');
      expect(onPick).toHaveBeenCalledWith('u2', 'Bob Stone');
    });

    it('Given the picker When Escape is pressed Then onClose is called', () => {
      const { onClose } = setup();
      key('Escape');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Given the picker When an unrelated key is pressed Then nothing fires', () => {
      const { onClose, onPick } = setup();
      key('a');
      expect(onClose).not.toHaveBeenCalled();
      expect(onPick).not.toHaveBeenCalled();
    });

    it('Given the picker When unmounted Then key handlers are removed', () => {
      const { onClose, unmount } = setup();
      unmount();
      key('Escape');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Given a focused option When Enter is pressed natively Then the window handler picks without double firing via click', () => {
      const { onPick } = setup();
      screen.getAllByRole('option')[0].focus();
      key('Enter');
      expect(onPick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario error path', () => {
    it('Given onPick throws When clicked Then the picker remains rendered', () => {
      const onErr = (e: ErrorEvent) => e.preventDefault();
      window.addEventListener('error', onErr);
      const { } = setup({ onPick: () => { throw new Error('boom'); } });
      fireEvent.click(screen.getAllByRole('option')[0]);
      window.removeEventListener('error', onErr);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });
});
