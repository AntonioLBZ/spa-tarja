import * as v from 'valibot';

const NICKNAME_MAX_LENGTH = 30;

// Null takes the nickname away
const profileInputSchema = v.object({
    nickname: v.nullable(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(NICKNAME_MAX_LENGTH))),
});

type ProfileInput = v.InferOutput<typeof profileInputSchema>;

// What a person's friends see of them: the nickname, or else the name of the account. Never the email.
interface Profile {
    nickname: string | null;
    name: string;
}

export { NICKNAME_MAX_LENGTH, profileInputSchema, type Profile, type ProfileInput };
