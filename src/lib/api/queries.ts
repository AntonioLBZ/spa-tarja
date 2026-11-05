import { queryOptions } from '@tanstack/react-query';

import { BUDGETS_KEY, fetchBudgets } from './budgets';
import { CATEGORIES_KEY, fetchCategories } from './categories';
import { api } from './client';
import { GROUPS_KEY, fetchGroups } from './groups';
import { INCOME_KEY, fetchIncome } from './income';
import { fetchFriendInvitation, friendInvitationKey, readInvitation } from './invitations';
import { PROFILE_KEY, fetchProfile } from './profile';

const healthQuery = () => {
    return queryOptions({
        queryKey: ['health'],
        queryFn: async () => {
            const response = await api.api.health.$get();
            if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
            return response.json();
        },
    });
};

// The custom categories, kept offline by the persisted cache
const categoriesQuery = () => {
    return queryOptions({ queryKey: CATEGORIES_KEY, queryFn: fetchCategories });
};

// What the person earns each month, kept offline by the persisted cache
const incomeQuery = () => {
    return queryOptions({ queryKey: INCOME_KEY, queryFn: fetchIncome });
};

// The limits each month sets, kept offline by the persisted cache
const budgetsQuery = () => {
    return queryOptions({ queryKey: BUDGETS_KEY, queryFn: fetchBudgets });
};

// The groups and friends the person is in, closed ones too, kept offline by the persisted cache
const groupsQuery = () => {
    return queryOptions({ queryKey: GROUPS_KEY, queryFn: fetchGroups });
};

// The nickname, which needs a connection to change and is not kept offline
const profileQuery = () => {
    return queryOptions({ queryKey: PROFILE_KEY, queryFn: fetchProfile });
};

// The open link of a friend, or that it was declined, which needs a connection and is not kept offline
const friendInvitationQuery = (groupId: string) => {
    return queryOptions({ queryKey: friendInvitationKey(groupId), queryFn: () => fetchFriendInvitation(groupId) });
};

// What the link of an invitation shows, which needs a connection and is not kept offline
const invitationQuery = (token: string) => {
    return queryOptions({ queryKey: ['invitation', token], queryFn: () => readInvitation(token) });
};

export {
    budgetsQuery,
    categoriesQuery,
    friendInvitationQuery,
    groupsQuery,
    healthQuery,
    incomeQuery,
    invitationQuery,
    profileQuery,
};
