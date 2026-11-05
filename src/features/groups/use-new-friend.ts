import { useState } from 'react';
import * as v from 'valibot';

import { sharedNameSchema } from '@core/shared-group';

import { failureOf, type GroupFailure } from './group-failure';
import { useGroupActions } from './use-group-actions';

import type { SharedGroup } from '@core/shared-group';

// A friend by name: a group of two, the person and a dummy they can invite later (ADR-0014). The ids are made once and
// kept while the form is there, so a friend sent again after an answer that never came is the same friend.
const useNewFriend = () => {
    const { createFriend, savePerson } = useGroupActions();
    const [ids] = useState(() => ({ group: crypto.randomUUID(), me: crypto.randomUUID(), other: crypto.randomUUID() }));
    const [name, setName] = useState('');
    const [invalid, setInvalid] = useState(false);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const [busy, setBusy] = useState(false);

    return {
        name,
        invalid,
        failure,
        busy,
        type: (value: string) => {
            setName(value);
            setInvalid(false);
        },
        // The friend, or null when the name is refused before sending or the friend isn't made, which it keeps
        make: async (): Promise<SharedGroup | null> => {
            const parsed = v.safeParse(sharedNameSchema, name);
            if (!parsed.success) {
                setInvalid(true);
                return null;
            }

            setFailure(null);
            setBusy(true);
            try {
                const friend = await createFriend({
                    id: ids.group,
                    me: ids.me,
                    other: { id: ids.other, name: parsed.output },
                });
                // Made by a send whose answer was lost, it has the name typed then
                const other = friend.members.find((member) => member.id === ids.other);
                if (other && !other.claimed && other.name !== parsed.output) {
                    await savePerson(friend.id, ids.other, parsed.output);
                }
                return friend;
            } catch (error) {
                setFailure(failureOf(error));
                return null;
            } finally {
                setBusy(false);
            }
        },
    };
};

export { useNewFriend };
