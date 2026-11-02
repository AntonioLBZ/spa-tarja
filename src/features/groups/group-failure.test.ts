import { describe, expect, it } from 'vitest';

import en from '@/assets/locales/en.json';
import { ApiError } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderAppHook, stubApi } from '@/lib/test/render-app';
import { MAX_GROUP_MEMBERS, MAX_OPEN_GROUPS } from '@core/shared-group';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { LocalRefusal } from './local-refusal';

const text = en.groups.failure;

function words(failure: GroupFailure) {
    stubApi(createFakeApi().handler);
    return renderAppHook(() => useFailureWords()).result.current(failure);
}

describe('failureOf', () => {
    it.each([
        ['offline', 'offline'],
        ['read-only', 'readOnly'],
        ['unsynced', 'unsynced'],
    ] as const)('reads the refusal of the device %s', (code, failure) => {
        expect(failureOf(new LocalRefusal(code))).toBe(failure);
    });

    it.each([
        ['closed', 'readOnly'],
        ['unsettled', 'unsettled'],
        ['not-owner', 'notOwner'],
        ['owner', 'ownerLeaves'],
        ['unknown-member', 'memberGone'],
        ['member-left', 'memberGone'],
        ['not-a-user', 'notAUser'],
        ['not-placeholder', 'notPlaceholder'],
        ['too-many-groups', 'tooManyGroups'],
        ['too-many-members', 'tooManyMembers'],
    ] as const)('reads the refusal of the server %s', (code, failure) => {
        expect(failureOf(new ApiError(409, code))).toBe(failure);
    });

    it('takes anything else for a plain failure', () => {
        expect(failureOf(new ApiError(409, 'something-new'))).toBe('failed');
        expect(failureOf(new ApiError(503))).toBe('failed');
        expect(failureOf(new TypeError('Failed to fetch'))).toBe('failed');
    });
});

describe('useFailureWords', () => {
    it.each([
        'offline',
        'readOnly',
        'unsynced',
        'unsettled',
        'notOwner',
        'ownerLeaves',
        'memberGone',
        'notAUser',
        'notPlaceholder',
        'failed',
    ] as const)('words %s', (failure) => {
        expect(words(failure)).toBe(text[failure]);
    });

    it('says the limits it is about', () => {
        expect(words('tooManyGroups')).toBe(text.tooManyGroups.replace('{max}', String(MAX_OPEN_GROUPS)));
        expect(words('tooManyMembers')).toBe(text.tooManyMembers.replace('{max}', String(MAX_GROUP_MEMBERS)));
    });
});
