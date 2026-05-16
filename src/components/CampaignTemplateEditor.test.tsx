import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import CampaignTemplateEditor from './CampaignTemplateEditor';

describe('Given CampaignTemplateEditor', () => {
  it('When action / Then renders the editor with block toolbar', () => {
    render(<CampaignTemplateEditor value="" onChange={vi.fn()} />);
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Button')).toBeInTheDocument();
  });

  it('When action / Then adds a block when toolbar button is clicked', async () => {
    const onChange = vi.fn();
    render(<CampaignTemplateEditor value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('Header'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('When action / Then adds text block and calls onChange', async () => {
    const onChange = vi.fn();
    render(<CampaignTemplateEditor value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('Text'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('When action / Then adds image block', async () => {
    const onChange = vi.fn();
    render(<CampaignTemplateEditor value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('Image'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('When action / Then adds button block', async () => {
    const onChange = vi.fn();
    render(<CampaignTemplateEditor value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('Button'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('When action / Then adds divider block', async () => {
    const onChange = vi.fn();
    render(<CampaignTemplateEditor value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('Divider'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('When action / Then adds spacer block', async () => {
    const onChange = vi.fn();
    render(<CampaignTemplateEditor value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('Spacer'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('When action / Then adds columns block', async () => {
    const onChange = vi.fn();
    render(<CampaignTemplateEditor value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('2 Columns'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('When action / Then renders with initial value', () => {
    render(<CampaignTemplateEditor value="<h2>Hello</h2>" onChange={vi.fn()} />);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });
});
