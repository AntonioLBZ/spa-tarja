import type { Profile, ProfileInput } from '@core/profile';

// Only these two columns: the email of the account never leaves the server this way
const READ = `
    SELECT profile.nickname AS nickname, "user".name AS name
    FROM "user" LEFT JOIN profile ON profile.user_id = "user".id
    WHERE "user".id = ?1`;

const UPSERT = `
    INSERT INTO profile (user_id, nickname, updated_at) VALUES (?1, ?2, ?3)
    ON CONFLICT (user_id) DO UPDATE SET nickname = excluded.nickname, updated_at = excluded.updated_at`;

const readProfile = async (db: D1Database, userId: string): Promise<Profile> => {
    const profile = await db.prepare(READ).bind(userId).first<Profile>();
    if (!profile) throw new Error('The user does not exist');
    return profile;
};

// A nickname replaces the one there was and null deletes the row; the answer is read in the same batch
const saveProfile = async (db: D1Database, userId: string, input: ProfileInput): Promise<Profile> => {
    const write =
        input.nickname === null
            ? db.prepare('DELETE FROM profile WHERE user_id = ?1').bind(userId)
            : db.prepare(UPSERT).bind(userId, input.nickname, Date.now());
    const [, read] = await db.batch<Profile>([write, db.prepare(READ).bind(userId)]);
    const profile = read?.results[0];
    if (!profile) throw new Error('The user does not exist');
    return profile;
};

export { readProfile, saveProfile };
