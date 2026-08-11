import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import DetailBackLink, { hasInAppHistory, FLOATING_REVEAL_PX } from './DetailBackLink';

/**
 * Regression cover for "Back navigation is inaccessible after scrolling through
 * long detail pages" — the inline link scrolled out of reach, and it always
 * navigated to the module list even when the user had arrived from Tasks, search
 * results, or the dashboard.
 */

function renderAt(initialEntries: string[], initialIndex?: number) {
  const seen: string[] = [];
  const Probe: React.FC<{ name: string }> = ({ name }) => {
    seen.push(name);
    return <div data-testid="page">{name}</div>;
  };

  render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <Routes>
        <Route path="/crm/leads" element={<Probe name="leads-list" />} />
        <Route path="/crm/tasks" element={<TasksWithLink />} />
        <Route
          path="/crm/leads/:id"
          element={
            <>
              <Probe name="lead-detail" />
              <DetailBackLink fallbackTo="/crm/leads" label="Back to Leads" />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return seen;
}

/** A page that pushes an in-app history entry, so `location.key` is not 'default'. */
const TasksWithLink: React.FC = () => {
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="page">tasks-list</div>
      <button onClick={() => navigate('/crm/leads/abc')}>open lead</button>
    </>
  );
};

describe('Given hasInAppHistory', () => {
  it('When the entry is the first in the session / Then there is nothing to go back to', () => {
    expect(hasInAppHistory({ idx: 0 })).toBe(false);
  });

  it('When there is no router history state at all (deep link) / Then it reports false', () => {
    expect(hasInAppHistory(null)).toBe(false);
    expect(hasInAppHistory(undefined)).toBe(false);
    expect(hasInAppHistory({})).toBe(false);
  });

  it('When an earlier in-app entry exists / Then going back is possible', () => {
    expect(hasInAppHistory({ idx: 3 })).toBe(true);
  });
});

describe('Given a lead detail page opened directly (deep link, no in-app history)', () => {
  it('When the inline back control is used / Then it falls back to the module list', () => {
    renderAt(['/crm/leads/abc']);
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to Leads' })[0]);
    expect(screen.getByTestId('page')).toHaveTextContent('leads-list');
  });
});

describe('Given the user navigated in from another page', () => {
  afterEach(() => {
    window.history.replaceState(null, '');
  });

  it('When back is used / Then it returns to where they came from, not the module list', () => {
    renderAt(['/crm/tasks']);
    fireEvent.click(screen.getByRole('button', { name: 'open lead' }));
    expect(screen.getByTestId('page')).toHaveTextContent('lead-detail');

    // Router history records an earlier in-app entry.
    window.history.replaceState({ idx: 1 }, '');
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to Leads' })[0]);
    expect(screen.getByTestId('page')).toHaveTextContent('tasks-list');
  });
});

describe('Given a long detail page', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  it('When the page is at the top / Then the floating control is not reachable', () => {
    renderAt(['/crm/leads/abc']);
    expect(screen.getByTestId('detail-back-floating').className).toContain('pointer-events-none');
  });

  it('When the reader has scrolled past the header / Then the floating control becomes reachable', () => {
    renderAt(['/crm/leads/abc']);
    act(() => {
      (window as any).scrollY = FLOATING_REVEAL_PX + 50;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(screen.getByTestId('detail-back-floating').className).not.toContain('pointer-events-none');
  });

  it('When the scroll happens on an ancestor container (shell layout) / Then it is still detected', () => {
    renderAt(['/crm/leads/abc']);
    const scroller = document.createElement('div');
    Object.defineProperty(scroller, 'scrollTop', { value: FLOATING_REVEAL_PX + 1, configurable: true });
    document.body.appendChild(scroller);
    act(() => {
      scroller.dispatchEvent(new Event('scroll', { bubbles: false }));
    });
    expect(screen.getByTestId('detail-back-floating').className).not.toContain('pointer-events-none');
  });

  it('When the floating control is used / Then it navigates exactly like the inline one', () => {
    renderAt(['/crm/leads/abc']);
    fireEvent.click(screen.getByTestId('detail-back-floating'));
    expect(screen.getByTestId('page')).toHaveTextContent('leads-list');
  });
});
