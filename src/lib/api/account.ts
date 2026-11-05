import { toApiError } from './api-error';
import { api } from './client';

// Deletes the account of the signed-in user for good; the email of the account confirms it
const deleteAccount = async (email: string): Promise<void> => {
    const response = await api.api.account.$delete({ json: { email } });
    if (!response.ok) throw await toApiError(response);
};

export { deleteAccount };
