import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Table } from './Table';

interface Row {
  id: string;
  name: string;
  amount: number;
}

const rows: Row[] = [
  { id: 'r1', name: 'Alice', amount: 100 },
  { id: 'r2', name: 'Bob', amount: 200 },
  { id: 'r3', name: 'Charlie', amount: 300 },
];

const columns = [
  { header: 'Name', accessor: 'name' as const },
  { header: 'Amount', accessor: 'amount' as const },
];

describe('Table', () => {
  describe('Given data is loading', () => {
    it('When isLoading is true / Then shows skeleton rows instead of data', () => {
      const { container } = render(<Table data={[]} columns={columns} isLoading={true} />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('When isLoading is true / Then does not render column headers', () => {
      render(<Table data={[]} columns={columns} isLoading={true} />);
      expect(screen.queryByText('Name')).not.toBeInTheDocument();
    });
  });

  describe('Given data is empty', () => {
    it('When data is an empty array / Then shows default empty message', () => {
      render(<Table data={[]} columns={columns} />);
      expect(screen.getByText('No records found')).toBeInTheDocument();
    });

    it('When a custom emptyMessage is provided / Then shows that message', () => {
      render(<Table data={[]} columns={columns} emptyMessage="No deals yet" />);
      expect(screen.getByText('No deals yet')).toBeInTheDocument();
    });
  });

  describe('Given data is populated', () => {
    it('When rendered / Then shows all column headers', () => {
      render(<Table data={rows} columns={columns} />);
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
    });

    it('When rendered / Then shows all row data', () => {
      render(<Table data={rows} columns={columns} />);
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('When rendered / Then renders the correct number of rows', () => {
      const { container } = render(<Table data={rows} columns={columns} />);
      expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    });
  });

  describe('Given a row click handler is provided', () => {
    it('When a row is clicked / Then calls onRowClick with the row data', () => {
      const onRowClick = vi.fn();
      render(<Table data={rows} columns={columns} onRowClick={onRowClick} />);
      fireEvent.click(screen.getByText('Alice'));
      expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    });

    it('When rendered with onRowClick / Then rows have cursor-pointer class', () => {
      const { container } = render(<Table data={rows} columns={columns} onRowClick={vi.fn()} />);
      const row = container.querySelector('tbody tr');
      expect(row?.className).toContain('cursor-pointer');
    });
  });

  describe('Given no row click handler', () => {
    it('When a row is clicked / Then does not throw', () => {
      render(<Table data={rows} columns={columns} />);
      expect(() => fireEvent.click(screen.getByText('Alice'))).not.toThrow();
    });

    it('When rendered / Then rows do not have cursor-pointer class', () => {
      const { container } = render(<Table data={rows} columns={columns} />);
      const row = container.querySelector('tbody tr');
      expect(row?.className).not.toContain('cursor-pointer');
    });
  });

  describe('Given a function accessor is used for a column', () => {
    it('When rendered / Then renders the custom cell content', () => {
      const cols = [
        { header: 'Name', accessor: 'name' as const },
        {
          header: 'Custom',
          accessor: (item: Row) => <span data-testid={`cell-${item.id}`}>${item.amount}</span>,
        },
      ];
      render(<Table data={rows} columns={cols} />);
      expect(screen.getByTestId('cell-r1')).toHaveTextContent('$100');
      expect(screen.getByTestId('cell-r2')).toHaveTextContent('$200');
    });
  });

  describe('Given a ReactNode is used as a column header', () => {
    it('When rendered / Then shows the custom header element', () => {
      const cols = [
        { header: <span data-testid="custom-header">Special</span>, accessor: 'name' as const },
      ];
      render(<Table data={rows} columns={cols} />);
      expect(screen.getByTestId('custom-header')).toBeInTheDocument();
    });
  });
});
