import { fireEvent, screen } from '@testing-library/react';

/** Open the title-area Filters drawer (idempotent: a second call keeps it open). */
export const openFilters = () => {
  if (!screen.queryByRole('dialog', { name: 'Filters' })) {
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  }
};

/** Change a drawer select / text field by its label. */
export const setFilter = (label: string, value: string) => {
  openFilters();
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

/** Choose a segment (radio) option in the drawer. */
export const pickSegment = (group: string, option: string) => {
  openFilters();
  const radios = Array.from(screen.getByRole('radiogroup', { name: group }).querySelectorAll('label'));
  const hit = radios.find((l) => l.textContent === option);
  if (!hit) throw new Error(`No "${option}" option in "${group}"`);
  fireEvent.click(hit.querySelector('input')!);
};
