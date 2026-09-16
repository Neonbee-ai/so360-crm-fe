import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import DetailBackLink, { hasInAppHistory, backTargetFromState, FLOATING_REVEAL_PX, BACK_LABEL } from './DetailBackLink';

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
              <DetailBackLink fallbackTo="/crm/leads" />
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
    fireEvent.click(screen.getAllByRole('button', { name: BACK_LABEL })[0]);
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
    fireEvent.click(screen.getAllByRole('button', { name: BACK_LABEL })[0]);
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

describe('Given the control is used across modules', () => {
  it('When no label is supplied / Then every detail page shows the same neutral "Back"', () => {
    renderAt(['/crm/leads/abc']);
    // Both the inline and the floating control, so the wording never differs
    // between the two affordances on the same page.
    const controls = screen.getAllByRole('button', { name: BACK_LABEL });
    expect(controls).toHaveLength(2);
    expect(BACK_LABEL).toBe('Back');
  });

  it('When the module list name is used as a label / Then it is only the fallback destination, not the wording', () => {
    // Guards the regression this replaced: "Back to Leads" promised the leads
    // list even when the user had arrived from Tasks.
    renderAt(['/crm/leads/abc']);
    expect(screen.queryByText('Back to Leads')).toBeNull();
  });
});

/**
 * Regression cover for "Back from a Quote opened from the Quotes list lands on
 * Deal Details". Raw history is only as good as what is on the stack; the page
 * that opened the record knows exactly where the reader was, and says so.
 */
describe('Given backTargetFromState', () => {
  it('When the opener recorded a route / Then that route is the destination', () => {
    expect(backTargetFromState({ from: '/crm/quotes?status=sent&page=2' }))
      .toBe('/crm/quotes?status=sent&page=2');
  });

  it('When nothing was recorded / Then there is no explicit destination', () => {
    expect(backTargetFromState(null)).toBeNull();
    expect(backTargetFromState(undefined)).toBeNull();
    expect(backTargetFromState({})).toBeNull();
  });

  it('When the recorded value is not an in-app path / Then it is refused', () => {
    // Guards against an off-site redirect being smuggled in through router state.
    expect(backTargetFromState({ from: 'https://example.com' })).toBeNull();
    expect(backTargetFromState({ from: 'crm/quotes' })).toBeNull();
    expect(backTargetFromState({ from: 42 })).toBeNull();
  });
});

describe('Given a record was opened with its origin recorded', () => {
  afterEach(() => {
    window.history.replaceState(null, '');
  });

  it('When Back is used / Then the reader returns to that exact URL, not wherever history happens to point', () => {
    const Probe: React.FC<{ name: string }> = ({ name }) => <div data-testid="page">{name}</div>;

    // React Router stores a navigation's `state` under `history.state.usr`.
    // Stamped here directly because the scenario under test is precisely "the
    // history stack would take you somewhere else" — the previous entry is the
    // deal, and the recorded origin must win over it.
    window.history.replaceState({ idx: 2, usr: { from: '/crm/quotes?status=sent' } }, '');

    render(
      <MemoryRouter initialEntries={['/crm/quotes?status=sent', '/crm/deal/d1', '/crm/quotes/q1']} initialIndex={2}>
        <Routes>
          <Route path="/crm/deal/:id" element={<Probe name="deal-detail" />} />
          <Route path="/crm/quotes" element={<Probe name="quotes-list" />} />
          <Route
            path="/crm/quotes/:id"
            element={
              <>
                <Probe name="quote-detail" />
                <DetailBackLink fallbackTo="/crm/leads" />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('page')).toHaveTextContent('quote-detail');
    fireEvent.click(screen.getAllByRole('button', { name: BACK_LABEL })[0]);
    // The immediately preceding entry is the deal, so plain history would land
    // there — the recorded origin is what makes this correct.
    expect(screen.getByTestId('page')).toHaveTextContent('quotes-list');
  });

  it('When Back is double-clicked / Then it does not overshoot past the page it came from', () => {
    const Probe: React.FC<{ name: string }> = ({ name }) => <div data-testid="page">{name}</div>;
    const QuotesListWithLink: React.FC = () => {
      const navigate = useNavigate();
      return (
        <>
          <div data-testid="page">quotes-list</div>
          <button onClick={() => navigate('/crm/quotes/q1')}>open quote</button>
        </>
      );
    };

    render(
      <MemoryRouter initialEntries={['/crm/deal/d1', '/crm/quotes']} initialIndex={1}>
        <Routes>
          <Route path="/crm/deal/:id" element={<Probe name="deal-detail" />} />
          <Route path="/crm/quotes" element={<QuotesListWithLink />} />
          <Route
            path="/crm/quotes/:id"
            element={
              <>
                <Probe name="quote-detail" />
                <DetailBackLink fallbackTo="/crm/quotes" />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('open quote'));
    const back = screen.getAllByRole('button', { name: BACK_LABEL })[0];
    fireEvent.click(back);
    fireEvent.click(back);

    expect(screen.getByTestId('page')).toHaveTextContent('quotes-list');
  });
});
