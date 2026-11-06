import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { PROFILE_KEY, putProfile } from '@/lib/api';

import type { Profile } from '@core/profile';

// Waits for the server and then puts its answer in the cache, so the profile never needs a refetch
const useProfileActions = () => {
    const queryClient = useQueryClient();

    return useMemo(
        () => ({
            async save(nickname: string | null) {
                queryClient.setQueryData<Profile>(PROFILE_KEY, await putProfile({ nickname }));
            },
        }),
        [queryClient]
    );
};

export { useProfileActions };
