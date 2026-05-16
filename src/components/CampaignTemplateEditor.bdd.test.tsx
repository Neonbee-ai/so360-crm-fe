import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import CampaignTemplateEditor from './CampaignTemplateEditor';

describe('CampaignTemplateEditor', () => {
  describe('Given the editor is rendered', () => {
    it('When rendered / Then shows all block type buttons in the toolbar', () => {
      render(<CampaignTemplateEditor value="" onChange={vi.fn()} />);
      expect(screen.getByText('Header')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
      expect(screen.getByText('Button')).toBeInTheDocument();
      expect(screen.getByText('Divider')).toBeInTheDocument();
      expect(screen.getByText('Spacer')).toBeInTheDocument();
      expect(screen.getByText('2 Columns')).toBeInTheDocument();
    });

    it('When rendered with an initial HTML value / Then still shows the toolbar', () => {
      render(<CampaignTemplateEditor value="<h2>Hello World</h2>" onChange={vi.fn()} />);
      expect(screen.getByText('Header')).toBeInTheDocument();
    });
  });

  describe('Given the user adds a Header block', () => {
    it('When the Header button is clicked / Then calls onChange with updated HTML', async () => {
      const onChange = vi.fn();
      render(<CampaignTemplateEditor value="" onChange={onChange} />);
      fireEvent.click(screen.getByText('Header'));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
      const html = onChange.mock.calls[onChange.mock.calls.length - 1][0] as string;
      expect(typeof html).toBe('string');
    });
  });

  describe('Given the user adds a Text block', () => {
    it('When the Text button is clicked / Then calls onChange', async () => {
      const onChange = vi.fn();
      render(<CampaignTemplateEditor value="" onChange={onChange} />);
      fireEvent.click(screen.getByText('Text'));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
    });
  });

  describe('Given the user adds an Image block', () => {
    it('When the Image button is clicked / Then calls onChange', async () => {
      const onChange = vi.fn();
      render(<CampaignTemplateEditor value="" onChange={onChange} />);
      fireEvent.click(screen.getByText('Image'));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
    });
  });

  describe('Given the user adds a Button block', () => {
    it('When the Button block button is clicked / Then calls onChange', async () => {
      const onChange = vi.fn();
      render(<CampaignTemplateEditor value="" onChange={onChange} />);
      fireEvent.click(screen.getByText('Button'));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
    });
  });

  describe('Given the user adds a Divider block', () => {
    it('When the Divider button is clicked / Then calls onChange', async () => {
      const onChange = vi.fn();
      render(<CampaignTemplateEditor value="" onChange={onChange} />);
      fireEvent.click(screen.getByText('Divider'));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
    });
  });

  describe('Given the user adds a Spacer block', () => {
    it('When the Spacer button is clicked / Then calls onChange', async () => {
      const onChange = vi.fn();
      render(<CampaignTemplateEditor value="" onChange={onChange} />);
      fireEvent.click(screen.getByText('Spacer'));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
    });
  });

  describe('Given the user adds a 2 Columns block', () => {
    it('When the 2 Columns button is clicked / Then calls onChange', async () => {
      const onChange = vi.fn();
      render(<CampaignTemplateEditor value="" onChange={onChange} />);
      fireEvent.click(screen.getByText('2 Columns'));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
    });
  });
});
