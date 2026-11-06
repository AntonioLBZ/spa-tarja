import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { ApiError } from '@/lib/api';
import {
    MAX_CLOSED_GROUPS,
    MAX_FRIENDS,
    MAX_GROUP_MEMBERS,
    MAX_OPEN_GROUPS,
    MAX_OPEN_INVITATIONS,
} from '@core/shared-group';

import { LocalRefusal } from './local-refusal';

// Why a change to a group didn't happen, as the screens word it
type GroupFailure =
    | 'offline'
    | 'readOnly'
    | 'unsynced'
    | 'unsettled'
    | 'notOwner'
    | 'ownerLeaves'
    | 'memberGone'
    | 'notAUser'
    | 'notPlaceholder'
    | 'tooManyGroups'
    | 'tooManyFriends'
    | 'friendTooManyGroups'
    | 'tooManyClosedGroups'
    | 'friendTooManyClosedGroups'
    | 'alreadyMember'
    | 'unknownFriend'
    | 'tooManyMembers'
    | 'tooManyInvitations'
    | 'failed';

const SERVER_FAILURES: Partial<Record<string, GroupFailure>> = {
    closed: 'readOnly',
    unsettled: 'unsettled',
    'not-owner': 'notOwner',
    owner: 'ownerLeaves',
    'unknown-member': 'memberGone',
    'member-left': 'memberGone',
    'not-a-user': 'notAUser',
    'not-placeholder': 'notPlaceholder',
    'too-many-groups': 'tooManyGroups',
    'too-many-friends': 'tooManyFriends',
    'too-many-closed-groups': 'tooManyClosedGroups',
    'already-member': 'alreadyMember',
    'unknown-friend': 'unknownFriend',
    'too-many-members': 'tooManyMembers',
    'too-many-invitations': 'tooManyInvitations',
};

// A refusal of the device or of the server; anything else, a dropped connection included, is a plain failure
const failureOf = (error: unknown): GroupFailure => {
    if (error instanceof LocalRefusal) return error.code === 'read-only' ? 'readOnly' : error.code;
    if (error instanceof ApiError && error.code !== null) return SERVER_FAILURES[error.code] ?? 'failed';
    return 'failed';
};

// A refusal of adding one of the person's friends to a group, where a limit of groups is the friend's
const failureOfFriend = (error: unknown): GroupFailure => {
    const failure = failureOf(error);
    if (failure === 'tooManyGroups') return 'friendTooManyGroups';
    return failure === 'tooManyClosedGroups' ? 'friendTooManyClosedGroups' : failure;
};

const useFailureWords = () => {
    const t = useTranslations('groups.failure');

    return useCallback(
        (failure: GroupFailure) => {
            if (failure === 'tooManyGroups' || failure === 'friendTooManyGroups') {
                return t(failure, { max: MAX_OPEN_GROUPS });
            }
            if (failure === 'tooManyClosedGroups' || failure === 'friendTooManyClosedGroups') {
                return t(failure, { max: MAX_CLOSED_GROUPS });
            }
            if (failure === 'tooManyFriends') return t(failure, { max: MAX_FRIENDS });
            if (failure === 'tooManyMembers') return t(failure, { max: MAX_GROUP_MEMBERS });
            if (failure === 'tooManyInvitations') return t(failure, { max: MAX_OPEN_INVITATIONS });
            return t(failure);
        },
        [t]
    );
};

export { failureOf, failureOfFriend, useFailureWords, type GroupFailure };
