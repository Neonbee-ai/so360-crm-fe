import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DuplicateLeadWarning } from './DuplicateLeadWarning';

describe('Given a duplicate lead reported by crm-be', () => {
    describe('When the warning renders', () => {
        it('Then it names the lead and owner and links to the existing lead', () => {
            render(<DuplicateLeadWarning duplicate={{ id: 'l9', name: 'Acme', owner_name: 'Priya' }} onCancel={vi.fn()} />);
            const w = screen.getByTestId('duplicate-lead-warning');
            expect(w).toHaveAttribute('role', 'alert');
            expect(w).toHaveTextContent('Acme');
            expect(w).toHaveTextContent('owned by Priya');
            expect(screen.getByRole('link', { name: 'Open existing' })).toHaveAttribute('href', '/crm/leads/l9');
        });
        it('Then no owner clause appears when the owner is unknown', () => {
            render(<DuplicateLeadWarning duplicate={{ id: 'l9', name: 'Acme', owner_name: null }} onCancel={vi.fn()} />);
            expect(screen.getByTestId('duplicate-lead-warning')).not.toHaveTextContent('owned by');
        });
    });
    describe('When Cancel is tapped', () => {
        it('Then onCancel is called', () => {
            const onCancel = vi.fn();
            render(<DuplicateLeadWarning duplicate={{ id: 'l9', name: 'Acme', owner_name: null }} onCancel={onCancel} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(onCancel).toHaveBeenCalledTimes(1);
        });
    });
});
