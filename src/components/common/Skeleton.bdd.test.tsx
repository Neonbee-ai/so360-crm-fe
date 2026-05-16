import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Skeleton, TableSkeleton } from './Skeleton';

describe('Skeleton', () => {
  describe('Given a Skeleton is rendered', () => {
    it('When rendered without props / Then shows an animated pulse element', () => {
      const { container } = render(<Skeleton />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain('animate-pulse');
    });

    it('When rendered without props / Then shows the muted background style', () => {
      const { container } = render(<Skeleton />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain('bg-slate-700/50');
    });

    it('When rendered without props / Then has rounded corners', () => {
      const { container } = render(<Skeleton />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain('rounded');
    });
  });

  describe('Given a className is passed', () => {
    it('When rendered with h-8 w-32 / Then applies those classes', () => {
      const { container } = render(<Skeleton className="h-8 w-32" />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain('h-8');
      expect(el.className).toContain('w-32');
    });

    it('When rendered with custom class / Then still keeps animate-pulse', () => {
      const { container } = render(<Skeleton className="my-custom" />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain('animate-pulse');
      expect(el.className).toContain('my-custom');
    });
  });
});

describe('TableSkeleton', () => {
  describe('Given a TableSkeleton is rendered', () => {
    it('When rendered / Then shows 5 skeleton rows', () => {
      const { container } = render(<TableSkeleton />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons).toHaveLength(5);
    });

    it('When rendered / Then each row is full-width', () => {
      const { container } = render(<TableSkeleton />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      skeletons.forEach((el) => {
        expect(el.className).toContain('w-full');
      });
    });

    it('When rendered / Then each row has a consistent height', () => {
      const { container } = render(<TableSkeleton />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      skeletons.forEach((el) => {
        expect(el.className).toContain('h-12');
      });
    });
  });
});
