import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Table } from './Table';

interface TestItem {
  id: string;
  name: string;
  value: number;
}

const testData: TestItem[] = [
  { id: '1', name: 'Alice', value: 100 },
  { id: '2', name: 'Bob', value: 200 },
  { id: '3', name: 'Charlie', value: 300 },
];

const testColumns = [
  { header: 'Name', accessor: 'name' as const },
  { header: 'Value', accessor: 'value' as const },
];

describe('Table', () => {
  it('renders table with data', () => {
    render(<Table data={testData} columns={testColumns} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(
      <Table data={[]} columns={testColumns} isLoading={true} />
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
  });

  it('renders empty message when data is empty', () => {
    render(<Table data={[]} columns={testColumns} />);
    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('renders custom empty message', () => {
    render(
      <Table data={[]} columns={testColumns} emptyMessage="Nothing here" />
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('calls onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn();
    render(
      <Table data={testData} columns={testColumns} onRowClick={onRowClick} />
    );

    fireEvent.click(screen.getByText('Alice'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(testData[0]);
  });

  it('does not throw when row is clicked without onRowClick', () => {
    render(<Table data={testData} columns={testColumns} />);
    expect(() => fireEvent.click(screen.getByText('Alice'))).not.toThrow();
  });

  it('supports function accessor for custom rendering', () => {
    const columns = [
      { header: 'Name', accessor: 'name' as const },
      {
        header: 'Formatted',
        accessor: (item: TestItem) => <span data-testid={`formatted-${item.id}`}>${item.value}</span>,
      },
    ];

    render(<Table data={testData} columns={columns} />);
    expect(screen.getByTestId('formatted-1')).toHaveTextContent('$100');
    expect(screen.getByTestId('formatted-2')).toHaveTextContent('$200');
  });

  it('renders correct number of rows', () => {
    const { container } = render(
      <Table data={testData} columns={testColumns} />
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
  });

  it('renders correct number of columns', () => {
    const { container } = render(
      <Table data={testData} columns={testColumns} />
    );
    const headerCells = container.querySelectorAll('thead th');
    expect(headerCells).toHaveLength(2);
  });

  it('applies cursor-pointer class when onRowClick is provided', () => {
    const { container } = render(
      <Table data={testData} columns={testColumns} onRowClick={vi.fn()} />
    );
    const row = container.querySelector('tbody tr');
    expect(row?.className).toContain('cursor-pointer');
  });

  it('does not apply cursor-pointer when onRowClick is absent', () => {
    const { container } = render(
      <Table data={testData} columns={testColumns} />
    );
    const row = container.querySelector('tbody tr');
    expect(row?.className).not.toContain('cursor-pointer');
  });

  it('supports ReactNode as column header', () => {
    const columns = [
      { header: <span data-testid="custom-header">Custom</span>, accessor: 'name' as const },
    ];
    render(<Table data={testData} columns={columns} />);
    expect(screen.getByTestId('custom-header')).toBeInTheDocument();
  });
});
