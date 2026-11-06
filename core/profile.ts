import * as v from 'valibot';

import { hasDirectionControls, isVisibleText } from './text';

// In UTF-16 code units, as a string's length counts them, so an emoji takes two
const NICKNAME_MAX_LENGTH = 30;

const nicknameSchema = v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(NICKNAME_MAX_LENGTH),
    v.check(isVisibleText, 'Nothing visible'),
    v.check((nickname) => !hasDirectionControls(nickname), 'Sets the direction of the text')
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
