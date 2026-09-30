import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import LeadLayoutSettingsPanel from './LeadLayoutSettingsPanel';

/** Feature: the shared layout panel, reused by the dashboard (RE §31). */
const sections = [{ key: 'a', visible: true }, { key: 'b', visible: false }];
const props = () => ({ sections, onToggleVisible: vi.fn(), onMove: vi.fn(), onReset: vi.fn(), onClose: vi.fn() });

describe('Given the layout settings panel', () => {
    describe('When no labels or title are given', () => {
        it('Then it keeps its lead-detail defaults and falls back to the key', () => {
            render(<LeadLayoutSettingsPanel {...props()} sections={[{ key: 'notes', visible: true }, { key: 'zzz', visible: true }]} />);
            expect(screen.getByRole('dialog', { name: 'Layout Settings' })).toBeInTheDocument();
            expect(screen.getByText('Notes')).toBeInTheDocument();
            expect(screen.getByText('zzz')).toBeInTheDocument();
        });
    });

    describe('When custom labels and a title are given', () => {
        it('Then rows, buttons and the dialog use them', () => {
            const p = props();
            render(<LeadLayoutSettingsPanel {...p} title="Customize Dashboard" labels={{ a: 'Alpha', b: 'Beta' }} />);
            expect(screen.getByRole('dialog', { name: 'Customize Dashboard' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Move Alpha up' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Move Beta down' })).toBeDisabled();
            fireEvent.click(screen.getByRole('button', { name: 'Move Alpha down' }));
            expect(p.onMove).toHaveBeenCalledWith('a', 'down');
            expect(screen.getByRole('button', { name: 'Hide Alpha' })).toHaveAttribute('aria-pressed', 'true');
            fireEvent.click(screen.getByRole('button', { name: 'Show Beta' }));
            expect(p.onToggleVisible).toHaveBeenCalledWith('b');
        });

        it('Then Reset and Close call back', () => {
            const p = props();
            render(<LeadLayoutSettingsPanel {...p} />);
            fireEvent.click(screen.getByRole('button', { name: /Reset to Default/ }));
            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            expect(p.onReset).toHaveBeenCalled();
            expect(p.onClose).toHaveBeenCalled();
        });
    });
});
