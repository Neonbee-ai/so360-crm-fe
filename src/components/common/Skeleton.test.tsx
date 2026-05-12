import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, TableSkeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders a div with animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('bg-slate-700/50');
    expect(el.className).toContain('rounded');
  });

  it('applies additional className', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-8');
    expect(el.className).toContain('w-32');
  });

  it('renders without className prop', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe('TableSkeleton', () => {
  it('renders 5 skeleton rows', () => {
    const { container } = render(<TableSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(5);
  });

  it('each row has h-12 and w-full classes', () => {
    const { container } = render(<TableSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    skeletons.forEach((el) => {
      expect(el.className).toContain('h-12');
      expect(el.className).toContain('w-full');
    });
  });
});
