import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RecordNotFound, isNotFoundError } from './RecordNotFound';

vi.mock('lucide-react', () => ({ SearchX: () => null }));
vi.mock('@so360/design-system', () => ({
  EmptyState: ({ title, description, action }: any) => (
    <div><p>{title}</p><p>{description}</p>{action && <button type="button" onClick={action.onClick}>{action.label}</button>}</div>
  ),
}));

describe('RecordNotFound', () => {
  describe('Given a record that does not exist', () => {
    it('When rendered, Then it shows the title and description', () => {
      render(<MemoryRouter><RecordNotFound listPath="/crm/leads" listLabel="Leads" /></MemoryRouter>);
      expect(screen.getByText('Record not found')).toBeInTheDocument();
      expect(screen.getByText("This record doesn't exist or you don't have access to it.")).toBeInTheDocument();
    });

    it('When the back action is clicked, Then it navigates to the list route', () => {
      render(
        <MemoryRouter initialEntries={['/detail']}>
          <Routes>
            <Route path="/detail" element={<RecordNotFound listPath="/list" listLabel="Leads" />} />
            <Route path="/list" element={<p>list page</p>} />
          </Routes>
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Back to Leads' }));
      expect(screen.getByText('list page')).toBeInTheDocument();
    });
  });

  describe('isNotFoundError', () => {
    it.each([[404, true], [403, true], [500, false], [502, false]])('Given status %s, Then it is %s', (status, want) => {
      expect(isNotFoundError({ status })).toBe(want);
    });
    it('Given a network error without status, Then it is not a not-found', () => {
      expect(isNotFoundError(new Error('Failed to fetch'))).toBe(false);
      expect(isNotFoundError(null)).toBe(false);
    });
  });
});
