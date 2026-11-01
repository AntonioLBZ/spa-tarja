import * as v from 'valibot';

// In UTF-16 code units, as a string's length counts them, so an emoji takes two
const NICKNAME_MAX_LENGTH = 30;

// A character that leaves a mark: not a space, a control, or a format or other ignorable character (zero-width ones)
const VISIBLE = /[^\s\p{Z}\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u;

const nicknameSchema = v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(NICKNAME_MAX_LENGTH),
    v.check((nickname) => VISIBLE.test(nickname), 'Nothing visible')
);

// Null takes the nickname away
const profileInputSchema = v.object({ nickname: v.nullable(nicknameSchema) });

type ProfileInput = v.InferOutput<typeof profileInputSchema>;

// What a person's friends see of them: the nickname, or else the name of the account. Never the email.
interface Profile {
    nickname: string | null;
    name: string;
}

export { NICKNAME_MAX_LENGTH, nicknameSchema, profileInputSchema, type Profile, type ProfileInput };
