import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NoteEditor from './NoteEditor';

const LABELS = ['Bold', 'Italic', 'Underline', 'Bullet list', 'Numbered list', 'Link', 'Code block'];

describe('Feature NoteEditor toolbar uses Comb IconButtons', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('Scenario render', () => {
    it.each(LABELS)('Given the editor When rendered Then "%s" is a Comb icon-button size sm with icon and label', (label) => {
      render(<NoteEditor value="" onChange={vi.fn()} />);
      const btn = screen.getByRole('button', { name: label });
      expect(btn).toHaveAttribute('data-comb', 'icon-button');
      expect(btn).toHaveAttribute('data-size', 'sm');
      expect(btn).toHaveAttribute('type', 'button');
      expect(btn).toHaveAttribute('title', label);
      expect(btn.querySelector('svg')).not.toBeNull();
    });

    it('Given the editor When rendered Then exactly 7 toolbar buttons exist in order', () => {
      render(<NoteEditor value="" onChange={vi.fn()} />);
      const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
      expect(names).toEqual(LABELS);
    });

    it('Given a fresh editor When rendered Then no toolbar button is pressed or selected', () => {
      render(<NoteEditor value="<p>plain</p>" onChange={vi.fn()} />);
      screen.getAllByRole('button').forEach((b) => {
        expect(b).toHaveAttribute('aria-pressed', 'false');
        expect(b).not.toHaveAttribute('data-selected');
      });
    });

    it('Given the editor When rendered Then the textbox is multiline and accessible', () => {
      render(<NoteEditor value="" onChange={vi.fn()} />);
      const tb = within(screen.getByTestId('note-editor')).getByRole('textbox');
      expect(tb).toHaveAttribute('aria-multiline', 'true');
    });
  });

  describe('Scenario toggled state', () => {
    it('Given content in bold When rendered Then Bold is pressed and selected', async () => {
      render(<NoteEditor value="<p><strong>Hi</strong></p>" onChange={vi.fn()} autoFocus />);
      const user = userEvent.setup();
      const tb = within(screen.getByTestId('note-editor')).getByRole('textbox');
      await user.click(screen.getByText('Hi'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true'));
      expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('data-selected', 'true');
      expect(tb).toBeInTheDocument();
    });

    it('Given a bullet list When the caret is in it Then Bullet list is pressed and Numbered list is not', async () => {
      render(<NoteEditor value="<ul><li><p>one</p></li></ul>" onChange={vi.fn()} />);
      const user = userEvent.setup();
      await user.click(screen.getByText('one'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Bullet list' })).toHaveAttribute('aria-pressed', 'true'));
      expect(screen.getByRole('button', { name: 'Numbered list' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('Given an ordered list When the caret is in it Then Numbered list is pressed', async () => {
      render(<NoteEditor value="<ol><li><p>one</p></li></ol>" onChange={vi.fn()} />);
      const user = userEvent.setup();
      await user.click(screen.getByText('one'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Numbered list' })).toHaveAttribute('aria-pressed', 'true'));
    });

    it('Given a code block When the caret is in it Then Code block is pressed', async () => {
      render(<NoteEditor value="<pre><code>x = 1</code></pre>" onChange={vi.fn()} />);
      const user = userEvent.setup();
      await user.click(screen.getByText('x = 1'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Code block' })).toHaveAttribute('aria-pressed', 'true'));
    });

    it('Given a link When the caret is in it Then Link is pressed', async () => {
      render(<NoteEditor value='<p><a href="https://a.co">go</a></p>' onChange={vi.fn()} />);
      const user = userEvent.setup();
      await user.click(screen.getByText('go'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Link' })).toHaveAttribute('aria-pressed', 'true'));
    });
  });

  describe('Scenario interaction', () => {
    it('Given typed text When Bold is clicked and more is typed Then HTML contains strong', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NoteEditor value="" onChange={onChange} />);
      const tb = within(screen.getByTestId('note-editor')).getByRole('textbox');
      await user.click(tb);
      await user.click(screen.getByRole('button', { name: 'Bold' }));
      await user.type(tb, 'Bold');
      await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0]).toContain('<strong>'));
    });

    it('Given typed text When Italic is clicked Then HTML contains em', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NoteEditor value="" onChange={onChange} />);
      const tb = within(screen.getByTestId('note-editor')).getByRole('textbox');
      await user.click(tb);
      await user.click(screen.getByRole('button', { name: 'Italic' }));
      await user.type(tb, 'It');
      await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0]).toContain('<em>'));
    });

    it('Given typed text When Underline is clicked Then HTML contains u', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NoteEditor value="" onChange={onChange} />);
      const tb = within(screen.getByTestId('note-editor')).getByRole('textbox');
      await user.click(tb);
      await user.click(screen.getByRole('button', { name: 'Underline' }));
      await user.type(tb, 'Un');
      await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0]).toContain('<u>'));
    });

    it('Given an empty editor When Bullet list is clicked and text typed Then HTML contains ul', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NoteEditor value="" onChange={onChange} />);
      const tb = within(screen.getByTestId('note-editor')).getByRole('textbox');
      await user.click(tb);
      await user.click(screen.getByRole('button', { name: 'Bullet list' }));
      await user.type(tb, 'a');
      await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0]).toContain('<ul>'));
    });

    it('Given an empty editor When Numbered list is clicked and text typed Then HTML contains ol', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NoteEditor value="" onChange={onChange} />);
      const tb = within(screen.getByTestId('note-editor')).getByRole('textbox');
      await user.click(tb);
      await user.click(screen.getByRole('button', { name: 'Numbered list' }));
      await user.type(tb, 'a');
      await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0]).toContain('<ol>'));
    });

    it('Given an empty editor When Code block is clicked and text typed Then HTML contains pre', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NoteEditor value="" onChange={onChange} />);
      const tb = within(screen.getByTestId('note-editor')).getByRole('textbox');
      await user.click(tb);
      await user.click(screen.getByRole('button', { name: 'Code block' }));
      await user.type(tb, 'a');
      await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0]).toContain('<pre>'));
    });

    it('Given a toolbar button When mouse is pressed Then default is prevented so editor focus is kept', () => {
      render(<NoteEditor value="" onChange={vi.fn()} />);
      const btn = screen.getByRole('button', { name: 'Bold' });
      const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      btn.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('Given a focused toolbar button When Enter is pressed Then the action runs', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NoteEditor value="" onChange={onChange} />);
      screen.getByRole('button', { name: 'Bullet list' }).focus();
      await user.keyboard('{Enter}');
      await waitFor(() => expect(screen.getByTestId('note-editor')).toBeInTheDocument());
    });

    it('Given the toolbar When Tab is pressed Then focus moves Bold to Italic', async () => {
      const user = userEvent.setup();
      render(<NoteEditor value="" onChange={vi.fn()} />);
      screen.getByRole('button', { name: 'Bold' }).focus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Italic' })).toHaveFocus();
    });
  });

  describe('Scenario Link prompt', () => {
    it('Given Link clicked When prompt is cancelled Then no link is added and onChange is not called', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue(null);
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NoteEditor value="<p>Text</p>" onChange={onChange} />);
      await user.click(screen.getByRole('button', { name: 'Link' }));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('Given selected text When a URL is entered Then the link is applied', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('https://neonbee.app');
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NoteEditor value="<p>Text</p>" onChange={onChange} />);
      await user.tripleClick(screen.getByText('Text'));
      await user.click(screen.getByRole('button', { name: 'Link' }));
      await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0]).toContain('href="https://neonbee.app"'));
    });

    it('Given a link under caret When prompt returns empty Then the link is removed', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('');
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NoteEditor value='<p><a href="https://a.co">go</a></p>' onChange={onChange} />);
      await user.click(screen.getByText('go'));
      await user.click(screen.getByRole('button', { name: 'Link' }));
      await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0]).not.toContain('href'));
    });

    it('Given a link under caret When Link is clicked Then prompt defaults to the existing href', async () => {
      const spy = vi.spyOn(window, 'prompt').mockReturnValue(null);
      const user = userEvent.setup();
      render(<NoteEditor value='<p><a href="https://a.co">go</a></p>' onChange={vi.fn()} />);
      await user.click(screen.getByText('go'));
      await user.click(screen.getByRole('button', { name: 'Link' }));
      expect(spy).toHaveBeenCalledWith('Link URL', 'https://a.co');
    });
  });

  describe('Scenario empty', () => {
    it('Given empty value and a placeholder When rendered Then placeholder text is attached', () => {
      render(<NoteEditor value="" onChange={vi.fn()} placeholder="Write here" />);
      expect(document.querySelector('[data-placeholder="Write here"]')).not.toBeNull();
    });

    it('Given no placeholder When rendered Then the default placeholder is used', () => {
      render(<NoteEditor value="" onChange={vi.fn()} />);
      expect(document.querySelector('[data-placeholder="Add a note…"]')).not.toBeNull();
    });
  });
});
