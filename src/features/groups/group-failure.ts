import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { ApiError } from '@/lib/api';
import { MAX_GROUP_MEMBERS, MAX_OPEN_GROUPS } from '@core/shared-group';

import { LocalRefusal } from './local-refusal';

// Why a change to a group didn't happen, as the screens word it
type GroupFailure =
    'offline' | 'readOnly' | 'unsynced' | 'unsettled' | 'notOwner' | 'tooManyGroups' | 'tooManyMembers' | 'failed';

const SERVER_FAILURES: Partial<Record<string, GroupFailure>> = {
    closed: 'readOnly',
    unsettled: 'unsettled',
    'not-owner': 'notOwner',
    'too-many-groups': 'tooManyGroups',
    'too-many-members': 'tooManyMembers',
};

// A refusal of the device or of the server; anything else, a dropped connection included, is a plain failure
const failureOf = (error: unknown): GroupFailure => {
    if (error instanceof LocalRefusal) return error.code === 'read-only' ? 'readOnly' : error.code;
    if (error instanceof ApiError && error.code !== null) return SERVER_FAILURES[error.code] ?? 'failed';
    return 'failed';
};

const useFailureWords = () => {
    const t = useTranslations('groups.failure');

    return useCallback(
        (failure: GroupFailure) => {
            if (failure === 'tooManyGroups') return t(failure, { max: MAX_OPEN_GROUPS });
            if (failure === 'tooManyMembers') return t(failure, { max: MAX_GROUP_MEMBERS });
            return t(failure);
        },
        [t]
    );
};

export { failureOf, useFailureWords, type GroupFailure };
