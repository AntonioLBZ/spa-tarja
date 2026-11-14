import { ApiError, toApiError } from './api-error';
import { api } from './client';

import type { PushSubscriptionInput } from '@core/push';

// The public key of the server, which a browser subscribes with
const fetchPushKey = async (): Promise<string> => {
    const response = await api.api.push.key.$get();
    if (!response.ok) throw new ApiError(response.status);
    return (await response.json()).key;
};

// Keeps the subscription of this device, or takes its new language; sending it twice is harmless
const putPush = async (input: PushSubscriptionInput): Promise<void> => {
    const response = await api.api.push.$put({ json: input });
    if (!response.ok) throw await toApiError(response);
};

const deletePush = async (endpoint: string): Promise<void> => {
    const response = await api.api.push.$delete({ json: { endpoint } });
    if (!response.ok) throw await toApiError(response);
};

export { deletePush, fetchPushKey, putPush };
