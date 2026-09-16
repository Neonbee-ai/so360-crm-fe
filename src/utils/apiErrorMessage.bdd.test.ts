import { describe, it, expect } from 'vitest';
import { describeApiError } from './apiErrorMessage';

const FALLBACK = 'We couldn’t do that. Please try again.';

const apiError = (message: string, status?: number) => {
    const err = new Error(message) as Error & { status?: number };
    if (status !== undefined) err.status = status;
    return err;
};

describe('describeApiError', () => {
    describe('Given the backend explained the rejection', () => {
        it('When a 400 carries a validation message / Then that message is shown', () => {
            expect(describeApiError(apiError('Please enter a valid company name.', 400), FALLBACK))
                .toBe('Please enter a valid company name.');
        });

        it('When a 409 reports a duplicate / Then that message is shown', () => {
            expect(describeApiError(apiError('A lead with this email already exists', 409), FALLBACK))
                .toBe('A lead with this email already exists');
        });

        it('When a 403 reports a permission problem / Then that message is shown', () => {
            expect(describeApiError(apiError('Insufficient permissions', 403), FALLBACK))
                .toBe('Insufficient permissions');
        });

        it('When a 404 names the missing record / Then that message is shown', () => {
            expect(describeApiError(apiError('Lead abc-123 not found', 404), FALLBACK))
                .toBe('Lead abc-123 not found');
        });
    });

    describe('Given the failure text is not meant for users', () => {
        it('When the message is Nest’s unmatched-route reply / Then the fallback is shown', () => {
            // This is verbatim what QA saw on the Delete Lead confirmation.
            expect(describeApiError(apiError('Cannot DELETE /leads/743f3067-7cc0-4f31-a509', 404), FALLBACK))
                .toBe(FALLBACK);
        });

        it.each(['Cannot GET /leads', 'Cannot POST /leads', 'Cannot PATCH /leads/1'])(
            'When the message is "%s" / Then the fallback is shown',
            (message) => {
                expect(describeApiError(apiError(message, 404), FALLBACK)).toBe(FALLBACK);
            },
        );

        it('When the message is a bare status echo / Then the fallback is shown', () => {
            expect(describeApiError(apiError('API Error: 500', 500), FALLBACK)).toBe(FALLBACK);
        });
    });

    describe('Given a genuine server-side fault', () => {
        it('When the status is 500 / Then the fallback is shown, not the internals', () => {
            expect(describeApiError(apiError('relation "leads" does not exist', 500), FALLBACK))
                .toBe(FALLBACK);
        });

        it('When the status is 503 / Then the fallback is shown', () => {
            expect(describeApiError(apiError('Service Unavailable', 503), FALLBACK)).toBe(FALLBACK);
        });
    });

    describe('Given a failure with no usable shape', () => {
        it('When the error carries no message / Then the fallback is shown', () => {
            expect(describeApiError(apiError(''), FALLBACK)).toBe(FALLBACK);
        });

        it('When the error carries no status (e.g. a network drop) / Then the fallback is shown', () => {
            expect(describeApiError(apiError('Failed to fetch'), FALLBACK)).toBe(FALLBACK);
        });

        it('When the value thrown is not an Error / Then the fallback is shown', () => {
            expect(describeApiError('something', FALLBACK)).toBe(FALLBACK);
            expect(describeApiError(null, FALLBACK)).toBe(FALLBACK);
        });
    });
});
