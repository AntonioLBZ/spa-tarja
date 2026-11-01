import { ApiError, toApiError } from './api-error';
import { api } from './client';

import type { Profile, ProfileInput } from '@core/profile';

const PROFILE_KEY = ['profile'] as const;

const fetchProfile = async (): Promise<Profile> => {
    const response = await api.api.profile.$get();
    if (!response.ok) throw new ApiError(response.status);
    return response.json();
};

// Sets the nickname, or takes it away with null, so sending it twice is harmless
const putProfile = async (input: ProfileInput): Promise<Profile> => {
    const response = await api.api.profile.$put({ json: input });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

export { PROFILE_KEY, fetchProfile, putProfile };
