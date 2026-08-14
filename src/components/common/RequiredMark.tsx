import React from 'react';

/**
 * The mandatory-field asterisk.
 *
 * Forms used to type `*` straight into the label text, so it inherited the
 * label's muted slate colour on some fields and was hand-coloured red on
 * others — the same signal rendered two different ways in one form. One
 * component keeps it uniform, and keeps it announced: the glyph is hidden from
 * assistive tech in favour of the word "required", since colour alone must
 * never be the only carrier of meaning.
 */
export const RequiredMark: React.FC = () => (
    <>
        <span aria-hidden="true" className="text-red-500">*</span>
        <span className="sr-only"> required</span>
    </>
);

export default RequiredMark;
