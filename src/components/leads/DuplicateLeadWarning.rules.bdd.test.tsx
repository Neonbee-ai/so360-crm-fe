import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DuplicateLeadWarning } from './DuplicateLeadWarning';

const dup = { id: 'l9', name: 'Acme', owner_name: null };

describe('Given a rule-based duplicate', () => {
    describe('When the rule only warns', () => {
        it('Then Create anyway is offered and fires', () => {
            const go = vi.fn();
            render(<DuplicateLeadWarning duplicate={dup} matchedOn="phone number" onCancel={vi.fn()} onCreateAnyway={go} />);
            expect(screen.getByTestId('duplicate-lead-warning')).toHaveTextContent('same phone number');
            fireEvent.click(screen.getByTestId('create-anyway'));
            expect(go).toHaveBeenCalledTimes(1);
        });
    });
    describe('When the rule blocks', () => {
        it('Then there is no Create anyway', () => {
            render(<DuplicateLeadWarning duplicate={dup} matchedOn="company name" onCancel={vi.fn()} />);
            expect(screen.queryByTestId('create-anyway')).toBeNull();
            expect(screen.getByTestId('open-existing-lead')).toHaveAttribute('href', '/crm/leads/l9');
        });
    });
});
