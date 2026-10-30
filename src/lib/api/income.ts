import { ApiError, toApiError } from './api-error';
import { api } from './client';

import type { Income, IncomeInput } from '@core/income';

const INCOME_KEY = ['income'] as const;

const fetchIncome = async (): Promise<Income[]> => {
    const response = await api.api.income.$get();
    if (!response.ok) throw new ApiError(response.status);
    return (await response.json()).income;
};

// Sets the income of a month, replacing what it had, so sending it twice is harmless
const putIncome = async (month: string, input: IncomeInput): Promise<Income> => {
    const response = await api.api.income[':month'].$put({ param: { month }, json: input });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

const deleteIncome = async (month: string): Promise<void> => {
    const response = await api.api.income[':month'].$delete({ param: { month } });
    if (!response.ok) throw new ApiError(response.status);
};

export { INCOME_KEY, deleteIncome, fetchIncome, putIncome };
