import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

/**
 * BDD specs for the person fields on Targets & Performance.
 *
 * These screens shipped with raw UUID text inputs and tables that printed the
 * first eight characters of a person id. Nobody can type a colleague's UUID
 * from memory, so the fields were effectively unusable and the tables were
 * unreadable. Every person field is now a search-suggest picker over the
 * People Connect directory, and every person id renders as a name.
 *
 * The directory is fetched through crm-be's broker route rather than People
 * Connect's public `/people`, which requires permissions a CRM user does not
 * hold — see the comment on getSalesReps.
 */

// vi.hoisted: vi.mock is lifted above the imports, so a plain `const` declared
// here would not exist yet when the factory runs.
const { getSalesReps } = vi.hoisted(() => ({ getSalesReps: vi.fn() }));

vi.mock('../../services/crmService', () => ({
  crmService: { getSalesReps },
}));

import {
  PersonName,
  PersonPicker,
  __resetPeopleDirectoryForTests,
} from './targetUi';

const ASHA = {
  id: '11111111-1111-4111-8111-111111111111',
  full_name: 'Asha Menon',
  email: 'asha@example.com',
  employee_id: 'E-1',
  job_title: 'Account Executive',
  department_name: 'Sales',
};

const BRIAN = {
  id: '22222222-2222-4222-8222-222222222222',
  full_name: 'Brian Kelly',
  email: 'brian@example.com',
  employee_id: 'E-2',
  job_title: 'Field Engineer',
  department_name: 'Delivery',
};

beforeEach(() => {
  __resetPeopleDirectoryForTests();
  getSalesReps.mockReset();
  getSalesReps.mockResolvedValue([BRIAN, ASHA]);
});

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <div data-testid="picker">
        <PersonPicker value={value} onChange={setValue} />
      </div>
      {/* Read-back of the stored value, kept OUTSIDE the picker so assertions
          about what the field displays are not satisfied by this probe. */}
      <div data-testid="value">{value}</div>
    </>
  );
}

describe('Given a person field on a targets screen', () => {
  it('When it mounts / Then it suggests people by name rather than asking for a UUID', async () => {
    render(<Harness />);
    await userEvent.click(await screen.findByRole('combobox'));

    // Sorted by name, so the list does not arrive in whatever order the
    // registry happened to return.
    const options = await screen.findAllByRole('button');
    expect(options[0]).toHaveTextContent('Asha Menon');
    expect(screen.getByText(/Brian Kelly/)).toBeInTheDocument();
  });

  it('When the user searches a job title / Then it still matches', async () => {
    // The registry API indexes only name, email and employee id. Filtering is
    // client-side precisely so searching by role or department is not a dead
    // end for the user.
    render(<Harness />);
    await userEvent.type(await screen.findByRole('combobox'), 'field eng');

    await waitFor(() => {
      expect(screen.getByText(/Brian Kelly/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Asha Menon/)).not.toBeInTheDocument();
  });

  it('When a search matches nobody / Then it says so instead of showing an empty box', async () => {
    render(<Harness />);
    await userEvent.type(await screen.findByRole('combobox'), 'zzzz');
    expect(await screen.findByText('No matching people')).toBeInTheDocument();
  });

  it('When a person is picked / Then the stored value is their id, not their name', async () => {
    // The API contracts take a People Connect person id. Storing a display
    // name here would break every downstream lookup.
    render(<Harness />);
    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(await screen.findByText(/Asha Menon/));

    await waitFor(() => {
      expect(screen.getByTestId('value')).toHaveTextContent(ASHA.id);
    });
  });

  it('When a value is already set / Then the field shows the name, never the raw id', async () => {
    render(<Harness initial={ASHA.id} />);
    expect(await screen.findByText(/Asha Menon/)).toBeInTheDocument();
    expect(
      within(screen.getByTestId('picker')).queryByText(ASHA.id),
    ).not.toBeInTheDocument();
  });

  it('When the selection is cleared / Then the field returns to searching', async () => {
    render(<Harness initial={ASHA.id} />);
    await userEvent.click(await screen.findByLabelText('Clear selection'));
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
  });
});

describe('Given several person fields on one screen', () => {
  it('When they mount together / Then the directory is fetched once, not once each', async () => {
    render(
      <>
        <Harness />
        <Harness />
        <PersonName id={ASHA.id} />
      </>,
    );

    await screen.findByText(/Asha Menon/);
    expect(getSalesReps).toHaveBeenCalledTimes(1);
  });
});

describe('Given the directory call fails', () => {
  it('When the field renders / Then it says so rather than looking like an empty org', async () => {
    getSalesReps.mockRejectedValueOnce(new Error('503'));
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveAttribute(
        'placeholder',
        'People directory unavailable',
      );
    });
  });

  it('When a later field mounts / Then it retries, because a rejection is not cached', async () => {
    // Caching the rejected promise would leave every picker on the page dead
    // until a full reload after one transient 503.
    getSalesReps.mockRejectedValueOnce(new Error('503'));
    const { unmount } = render(<Harness />);
    await waitFor(() => expect(getSalesReps).toHaveBeenCalledTimes(1));
    unmount();

    render(<Harness />);
    await screen.findByRole('combobox');
    await waitFor(() => expect(getSalesReps).toHaveBeenCalledTimes(2));
  });
});

describe('Given a person id rendered in a table', () => {
  it('When the person is known / Then their name is shown', async () => {
    render(<PersonName id={BRIAN.id} />);
    expect(await screen.findByText('Brian Kelly')).toBeInTheDocument();
  });

  it('When the person cannot be resolved / Then a short id is shown, not a blank cell', async () => {
    // Someone who left the org still has rows attached to them. A blank cell
    // reads as a rendering fault and makes two such rows indistinguishable.
    render(<PersonName id="99999999-9999-4999-8999-999999999999" />);
    expect(await screen.findByText('99999999')).toBeInTheDocument();
  });

  it('When there is no person at all / Then it renders a dash', async () => {
    render(<PersonName id={null} />);
    expect(await screen.findByText('—')).toBeInTheDocument();
  });
});
