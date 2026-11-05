import * as v from 'valibot';

// The longest an email address can be
const EMAIL_MAX_LENGTH = 254;

// Deleting an account takes its own email, typed to confirm
const accountDeletionSchema = v.object({ email: v.pipe(v.string(), v.maxLength(EMAIL_MAX_LENGTH)) });

// Whether what was typed is the email of the account, whatever its case and the spaces around it
const confirmsEmail = (typed: string, email: string): boolean => {
    return typed.trim().toLowerCase() === email.trim().toLowerCase();
};

export { EMAIL_MAX_LENGTH, accountDeletionSchema, confirmsEmail };
