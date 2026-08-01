import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NoteEditor from './NoteEditor';

describe('NoteEditor', () => {
  describe('Given initial HTML content', () => {
    it('When it renders / Then the content is visible', () => {
      render(<NoteEditor value="<p>Hello world</p>" onChange={vi.fn()} />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });

  describe('Given the toolbar', () => {
    it('When it renders / Then all formatting controls are present', () => {
      render(<NoteEditor value="" onChange={vi.fn()} />);
      expect(screen.getByLabelText('Bold')).toBeInTheDocument();
      expect(screen.getByLabelText('Italic')).toBeInTheDocument();
      expect(screen.getByLabelText('Underline')).toBeInTheDocument();
      expect(screen.getByLabelText('Bullet list')).toBeInTheDocument();
      expect(screen.getByLabelText('Numbered list')).toBeInTheDocument();
      expect(screen.getByLabelText('Link')).toBeInTheDocument();
      expect(screen.getByLabelText('Code block')).toBeInTheDocument();
    });

    it('When Bold is clicked / Then it does not throw and the editor stays mounted', async () => {
      const user = userEvent.setup();
      render(<NoteEditor value="<p>Text</p>" onChange={vi.fn()} />);
      await user.click(screen.getByLabelText('Bold'));
      expect(screen.getByTestId('note-editor')).toBeInTheDocument();
    });

    it('When Bullet list is clicked / Then it does not throw and the editor stays mounted', async () => {
      const user = userEvent.setup();
      render(<NoteEditor value="<p>Text</p>" onChange={vi.fn()} />);
      await user.click(screen.getByLabelText('Bullet list'));
      expect(screen.getByTestId('note-editor')).toBeInTheDocument();
    });

    it('When Numbered list is clicked / Then it does not throw and the editor stays mounted', async () => {
      const user = userEvent.setup();
      render(<NoteEditor value="<p>Text</p>" onChange={vi.fn()} />);
      await user.click(screen.getByLabelText('Numbered list'));
      expect(screen.getByTestId('note-editor')).toBeInTheDocument();
    });

    it('When Code block is clicked / Then it does not throw and the editor stays mounted', async () => {
      const user = userEvent.setup();
      render(<NoteEditor value="<p>Text</p>" onChange={vi.fn()} />);
      await user.click(screen.getByLabelText('Code block'));
      expect(screen.getByTestId('note-editor')).toBeInTheDocument();
    });

    it('When Link is clicked / Then it prompts for a URL', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
      const user = userEvent.setup();
      render(<NoteEditor value="<p>Text</p>" onChange={vi.fn()} />);
      await user.click(screen.getByLabelText('Link'));
      expect(promptSpy).toHaveBeenCalledWith('Link URL', 'https://');
      promptSpy.mockRestore();
    });
  });

  describe('Given the user types into the editor', () => {
    it('When text is entered / Then onChange fires with paragraph-wrapped HTML', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NoteEditor value="" onChange={onChange} />);
      const editable = within(screen.getByTestId('note-editor')).getByRole('textbox');
      await user.click(editable);
      await user.type(editable, 'Hello');
      await waitFor(() => expect(onChange).toHaveBeenCalled());
      const lastHtml = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastHtml).toContain('Hello');
    });
  });
});
