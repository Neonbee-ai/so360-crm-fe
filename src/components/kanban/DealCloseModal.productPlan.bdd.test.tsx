import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Pulse b1512967 — "Plan from deal products" on the won-deal form.
vi.mock('../common/Modal', () => ({
    Modal: ({ isOpen, children, title }: any) => isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));
vi.mock('../../hooks/useCrmFeatureFlag', () => ({ useCrmFeatureFlag: () => false }));
vi.mock('../../services/salesConfigService', () => ({ lossReasonsService: { list: vi.fn().mockResolvedValue([]) } }));
const shell = vi.hoisted(() => ({ flags: {} as Record<string, { enabled: boolean }>, loaded: true }));
vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ effectiveFlagsLoaded: shell.loaded, effectiveFlags: shell.flags, isFeatureEnabled: () => true }),
}));

import { DealCloseModal } from './DealCloseModal';

const FLAG = 'submodule:projects:deal_product_plan';
const deal = { id: 'd1', name: 'Big Deal', value: 900 } as any;
const setup = () => {
    const p = { onClose: vi.fn(), onWin: vi.fn(), onLose: vi.fn() };
    render(<DealCloseModal isOpen kind="won" deal={deal} stageName="Won" {...p} />);
    return p;
};
const submit = () => fireEvent.submit(document.querySelector('form')!);
const tickCreateProject = () => fireEvent.click(screen.getByLabelText(/create a project/i));

beforeEach(() => { shell.flags = {}; shell.loaded = true; });

describe('Given the deal product plan flag is off', () => {
    it('When a project is requested on win / Then no plan choice shows and the body is as today', () => {
        const p = setup();
        tickCreateProject();
        expect(screen.queryByLabelText('Project plan')).not.toBeInTheDocument();
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900, create_project: true });
    });
});

describe('Given the flag matrix has not loaded', () => {
    it('When a project is requested on win / Then the plan choice stays hidden (fail-closed)', () => {
        shell.loaded = false;
        shell.flags = { [FLAG]: { enabled: true } };
        setup();
        tickCreateProject();
        expect(screen.queryByLabelText('Project plan')).not.toBeInTheDocument();
    });
});

describe('Given the deal product plan flag is on', () => {
    beforeEach(() => { shell.flags = { [FLAG]: { enabled: true } }; });

    it('When no project is requested / Then the plan choice is hidden and nothing extra is sent', () => {
        const p = setup();
        expect(screen.queryByLabelText('Project plan')).not.toBeInTheDocument();
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900 });
    });

    it('When a project is requested and the default is kept / Then "Blank project" is sent as none', () => {
        const p = setup();
        tickCreateProject();
        expect((screen.getByLabelText('Project plan') as HTMLSelectElement).value).toBe('none');
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900, create_project: true, plan_from_products: 'none' });
    });

    it('When "Plan from deal products" is chosen / Then plan_from_products is phases', () => {
        const p = setup();
        tickCreateProject();
        fireEvent.change(screen.getByLabelText('Project plan'), { target: { value: 'phases' } });
        submit();
        expect(p.onWin).toHaveBeenCalledWith({ final_value: 900, create_project: true, plan_from_products: 'phases' });
    });
});
