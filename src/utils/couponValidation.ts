/**
 * Client-side mirror of the coupon validation rules enforced server-side in
 * so360-crm-be (dto/coupon rules, branch fix/coupon-validation-hardening).
 * Keeping both in sync means a bad form never round-trips to the API only to
 * bounce back with a 400 — the user sees the same message immediately.
 */

export interface CouponFormValues {
    code: string;
    description?: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    min_order_amount: number;
    usage_limit: number;
    valid_from: string;
    valid_until: string;
    is_active: boolean;
}

export type CouponFormErrors = Partial<Record<
    'code' | 'discount_value' | 'min_order_amount' | 'usage_limit' | 'valid_until',
    string
>>;

/**
 * `usage_limit` follows this app's existing convention: falsy/blank means
 * "unlimited", so it is only validated when a value is actually provided.
 */
export function validateCouponForm(form: CouponFormValues): CouponFormErrors {
    const errors: CouponFormErrors = {};

    if (!form.code || !form.code.trim()) errors.code = 'Coupon code is required';

    const discountValue = Number(form.discount_value);
    if (!(discountValue > 0)) {
        errors.discount_value = 'Discount value must be greater than 0';
    } else if (form.discount_type === 'percentage' && discountValue > 100) {
        errors.discount_value = 'Percentage discount cannot exceed 100%';
    }

    const minOrderAmount = Number(form.min_order_amount);
    if (form.min_order_amount && minOrderAmount < 0) {
        errors.min_order_amount = 'Minimum order amount cannot be negative';
    }

    const usageLimit = Number(form.usage_limit);
    if (form.usage_limit) {
        if (usageLimit < 0) errors.usage_limit = 'Usage limit cannot be negative';
        else if (!Number.isInteger(usageLimit)) errors.usage_limit = 'Usage limit must be a whole number';
    }

    if (form.valid_from && form.valid_until) {
        const from = new Date(form.valid_from).getTime();
        const until = new Date(form.valid_until).getTime();
        if (!(until > from)) errors.valid_until = 'Valid until date must be after the valid from date';
    }

    return errors;
}
