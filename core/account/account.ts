import * as v from 'valibot';

// The longest an email address can be
const EMAIL_MAX_LENGTH = 254;

// What a window of the app sends with every call to say which account it was opened for
const USER_HEADER = 'X-Tarja-User';

// Deleting an account takes its own email, typed to confirm
const accountDeletionSchema = v.object({ email: v.pipe(v.string(), v.maxLength(EMAIL_MAX_LENGTH)) });

// Whether what was typed is the email of the account, whatever its case and the spaces around it
const confirmsEmail = (typed: string, email: string): boolean => {
    return typed.trim().toLowerCase() === email.trim().toLowerCase();
};

export { EMAIL_MAX_LENGTH, USER_HEADER, accountDeletionSchema, confirmsEmail };
