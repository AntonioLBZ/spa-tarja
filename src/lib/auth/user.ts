import * as v from 'valibot';

// The part of the Better Auth user the app shows and keys its local data by
const authUserSchema = v.object({ id: v.pipe(v.string(), v.minLength(1)), name: v.string(), email: v.string() });

type AuthUser = v.InferOutput<typeof authUserSchema>;

export { authUserSchema, type AuthUser };
