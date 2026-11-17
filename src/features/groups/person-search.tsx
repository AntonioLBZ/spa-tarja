import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';
import * as v from 'valibot';

import { Dialog } from '@/components/dialog/dialog';
import { Field } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';
import { Notice } from '@/components/notice/notice';
import { useWide } from '@/lib/use-wide';
import { SHARED_NAME_MAX_LENGTH, sharedNameSchema } from '@core/shared-group';

import { matchesName } from './matches-name';

import './person-search.css';

import type { Friend } from './use-friends';

// What a press asks to add: one of the person's friends, or a dummy by the name typed
type PersonChoice = { friend: Friend } | { name: string };

interface PersonSearchProps {
    open: boolean;
    title: string;
    // The friends that may be offered, in the order to list them
    friends: readonly Friend[];
    // Every row is off: without a connection, or while a press is being sent
    disabled: boolean;
    // Said over the rows, which are off, when the group has no room for anybody else
    full?: ReactNode;
    // What went wrong with the last press, said over the rows
    failure?: ReactNode;
    // Shown in place of the search while a press asks for more
    step?: ReactNode;
    // The name of the person added, which the sheet then says, or null when nobody was added (yet)
    onPick: (choice: PersonChoice) => string | null | Promise<string | null>;
    onClose: () => void;
}

// Adding people by one search (ADR-0038): the friends whose name holds what is typed, then a dummy by that name. Each
// row is a button; the sheet stays open for the next one.
const PersonSearch = (props: PersonSearchProps) => {
    const { open, title, friends, disabled, full, failure, step, onPick, onClose } = props;
    const t = useTranslations('groups.search');
    const wide = useWide();
    const field = useRef<HTMLInputElement>(null);
    const listId = useId();
    const [query, setQuery] = useState('');
    const [added, setAdded] = useState('');

    // The field takes the focus back once a step that asked for more is over
    const hadStep = useRef(false);
    useEffect(() => {
        if (step) hadStep.current = true;
        else if (hadStep.current) {
            hadStep.current = false;
            field.current?.focus();
        }
    }, [step]);

    const parsed = v.safeParse(sharedNameSchema, query);
    const matches = friends.filter((friend) => matchesName(friend.name, query));
    const off = disabled || Boolean(full);

    const done = (name: string | null) => {
        if (name === null) return;
        setQuery('');
        setAdded(t('added', { name }));
        field.current?.focus();
    };

    // At once when the press needs no answer, so the next one finds the field empty
    const pick = (choice: PersonChoice) => {
        const result = onPick(choice);
        if (result instanceof Promise) void result.then(done);
        else done(result);
    };

    const close = () => {
        setQuery('');
        setAdded('');
        onClose();
    };

    return (
        <Dialog
            open={open}
            variant={wide ? 'sheet' : 'page'}
            title={title}
            closeLabel={t('close')}
            initialFocus={() => field.current}
            onClose={close}
        >
            {step ?? (
                <div className="person-search">
                    <Field label={t('field')} icon={<Icon name="search" />}>
                        {(control) => (
                            <input
                                {...control}
                                ref={field}
                                aria-controls={listId}
                                autoComplete="off"
                                enterKeyHint="search"
                                maxLength={SHARED_NAME_MAX_LENGTH}
                                type="search"
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setAdded('');
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') event.preventDefault();
                                }}
                            />
                        )}
                    </Field>
                    {full && <Notice role="alert">{full}</Notice>}
                    {failure && (
                        <Notice tone="danger" role="alert">
                            {failure}
                        </Notice>
                    )}
                    <ul className="person-search__rows" id={listId} aria-label={t('results')}>
                        {matches.map((friend) => (
                            <li key={friend.id}>
                                <button
                                    className="person-search__row"
                                    disabled={off}
                                    type="button"
                                    onClick={() => pick({ friend })}
                                >
                                    <Icon name="person_filled" />
                                    <span className="person-search__name">{friend.name}</span>
                                </button>
                            </li>
                        ))}
                        {parsed.success && (
                            <li>
                                <button
                                    className="person-search__row"
                                    disabled={off}
                                    type="button"
                                    onClick={() => pick({ name: parsed.output })}
                                >
                                    <Icon name="add" />
                                    <span className="person-search__name">
                                        <span>{t('byName', { name: parsed.output })}</span>
                                        <span className="person-search__detail">{t('byNameHint')}</span>
                                    </span>
                                </button>
                            </li>
                        )}
                    </ul>
                    {matches.length === 0 && !parsed.success && <p className="hint">{t('empty')}</p>}
                    <p className="person-search__added" role="status">
                        {added}
                    </p>
                </div>
            )}
        </Dialog>
    );
};

export { PersonSearch, type PersonChoice, type PersonSearchProps };
