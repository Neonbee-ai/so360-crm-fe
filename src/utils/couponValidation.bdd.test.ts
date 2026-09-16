import { describe, it, expect } from 'vitest';
import { validateCouponForm, CouponFormValues } from './couponValidation';

function baseCoupon(overrides: Partial<CouponFormValues> = {}): CouponFormValues {
    return {
        code: 'WELCOME20',
        description: '',
        discount_type: 'percentage',
        discount_value: 20,
        min_order_amount: 0,
        usage_limit: 0,
        valid_from: '',
        valid_until: '',
        is_active: true,
        ...overrides,
    };
}

describe('validateCouponForm', () => {
    describe('Given a valid coupon', () => {
        it('When validated / Then it passes with no errors', () => {
            expect(validateCouponForm(baseCoupon())).toEqual({});
        });
    });

    describe('Given a missing coupon code', () => {
        it('When the code is blank / Then it is rejected', () => {
            const errors = validateCouponForm(baseCoupon({ code: '' }));
            expect(errors.code).toBe('Coupon code is required');
        });

        it('When the code is whitespace only / Then it is rejected', () => {
            const errors = validateCouponForm(baseCoupon({ code: '   ' }));
            expect(errors.code).toBe('Coupon code is required');
        });
    });

    describe('Given a percentage discount', () => {
        it('When the value exceeds 100 / Then it is rejected', () => {
            const errors = validateCouponForm(baseCoupon({ discount_type: 'percentage', discount_value: 150 }));
            expect(errors.discount_value).toBe('Percentage discount cannot exceed 100%');
        });

        it('When the value is exactly 100 / Then it is accepted', () => {
            const errors = validateCouponForm(baseCoupon({ discount_type: 'percentage', discount_value: 100 }));
            expect(errors.discount_value).toBeUndefined();
        });

        it('When the value is 0 or less / Then it is rejected', () => {
            const errors = validateCouponForm(baseCoupon({ discount_type: 'percentage', discount_value: 0 }));
            expect(errors.discount_value).toBe('Discount value must be greater than 0');
        });
    });

    describe('Given a fixed-amount discount', () => {
        it('When the value is 0 or less / Then it is rejected', () => {
            const errors = validateCouponForm(baseCoupon({ discount_type: 'fixed', discount_value: 0 }));
            expect(errors.discount_value).toBe('Discount value must be greater than 0');
        });

        it('When the value is negative / Then it is rejected', () => {
            const errors = validateCouponForm(baseCoupon({ discount_type: 'fixed', discount_value: -5 }));
            expect(errors.discount_value).toBe('Discount value must be greater than 0');
        });

        it('When the value is above 100 / Then it is still accepted (no percentage cap applies)', () => {
            const errors = validateCouponForm(baseCoupon({ discount_type: 'fixed', discount_value: 500 }));
            expect(errors.discount_value).toBeUndefined();
        });
    });

    describe('Given a minimum order amount', () => {
        it('When the value is negative / Then it is rejected', () => {
            const errors = validateCouponForm(baseCoupon({ min_order_amount: -1 }));
            expect(errors.min_order_amount).toBe('Minimum order amount cannot be negative');
        });

        it('When the value is 0 (unset) / Then it is accepted', () => {
            const errors = validateCouponForm(baseCoupon({ min_order_amount: 0 }));
            expect(errors.min_order_amount).toBeUndefined();
        });
    });

    describe('Given a usage limit', () => {
        it('When the value is blank/0 / Then it is accepted (0 means unlimited)', () => {
            const errors = validateCouponForm(baseCoupon({ usage_limit: 0 }));
            expect(errors.usage_limit).toBeUndefined();
        });

        it('When the value is negative / Then it is rejected', () => {
            const errors = validateCouponForm(baseCoupon({ usage_limit: -10 }));
            expect(errors.usage_limit).toBe('Usage limit cannot be negative');
        });

        it('When the value is not a whole number / Then it is rejected', () => {
            const errors = validateCouponForm(baseCoupon({ usage_limit: 5.5 }));
            expect(errors.usage_limit).toBe('Usage limit must be a whole number');
        });

        it('When the value is a positive whole number / Then it is accepted', () => {
            const errors = validateCouponForm(baseCoupon({ usage_limit: 100 }));
            expect(errors.usage_limit).toBeUndefined();
        });
    });

    describe('Given a validity date range', () => {
        it('When valid_until is on or before valid_from / Then it is rejected', () => {
            const errors = validateCouponForm(
                baseCoupon({ valid_from: '2026-01-10', valid_until: '2026-01-10' }),
            );
            expect(errors.valid_until).toBe('Valid until date must be after the valid from date');
        });

        it('When valid_until is before valid_from / Then it is rejected', () => {
            const errors = validateCouponForm(
                baseCoupon({ valid_from: '2026-01-10', valid_until: '2026-01-01' }),
            );
            expect(errors.valid_until).toBe('Valid until date must be after the valid from date');
        });

        it('When valid_until is after valid_from / Then it is accepted', () => {
            const errors = validateCouponForm(
                baseCoupon({ valid_from: '2026-01-01', valid_until: '2026-01-10' }),
            );
            expect(errors.valid_until).toBeUndefined();
        });

        it('When either date is blank / Then the range check is skipped', () => {
            const errors = validateCouponForm(baseCoupon({ valid_from: '', valid_until: '2026-01-10' }));
            expect(errors.valid_until).toBeUndefined();
        });
    });
});
