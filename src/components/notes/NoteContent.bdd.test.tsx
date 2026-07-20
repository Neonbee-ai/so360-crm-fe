import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NoteContent from './NoteContent';

describe('NoteContent', () => {
  describe('Given plain formatted HTML', () => {
    it('When it renders / Then allowed tags and structure are preserved', () => {
      const { container } = render(<NoteContent html="<p>Hello <strong>world</strong></p><ul><li>one</li><li>two</li></ul>" />);
      expect(container.querySelector('strong')).not.toBeNull();
      expect(container.querySelectorAll('li')).toHaveLength(2);
      expect(screen.getByText('one')).toBeInTheDocument();
    });
  });

  describe('Given a script tag embedded in the content', () => {
    it('When it renders / Then the script tag is stripped', () => {
      const { container } = render(<NoteContent html="<p>hi</p><script>window.__pwned = true;</script>" />);
      expect(container.querySelector('script')).toBeNull();
      expect(screen.getByText('hi')).toBeInTheDocument();
    });
  });

  describe('Given an onerror handler attribute', () => {
    it('When it renders / Then the handler attribute is stripped', () => {
      const { container } = render(<NoteContent html={'<p onerror="alert(1)">hi</p>'} />);
      expect(container.querySelector('p')?.getAttribute('onerror')).toBeNull();
    });
  });

  describe('Given a link with a javascript: href', () => {
    it('When it renders / Then the href is stripped but the link text remains', () => {
      const { container } = render(<NoteContent html='<a href="javascript:alert(1)">click</a>' />);
      const link = container.querySelector('a');
      expect(link?.getAttribute('href')).toBeNull();
      expect(link?.textContent).toBe('click');
    });
  });

  describe('Given a safe https link', () => {
    it('When it renders / Then the href is preserved', () => {
      const { container } = render(<NoteContent html='<a href="https://example.com">click</a>' />);
      expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    });
  });
});
