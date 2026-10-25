import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

import { CATEGORY_NAME_MAX_LENGTH, type Category } from '@core/category';

import './category-row.css';

interface CategoryRowProps {
    category: Category;
    // Nothing can change without a connection
    disabled: boolean;
    // Whether another category, or a built-in one, already has this name
    isTaken: (name: string, exceptId: string) => boolean;
    // Resolves to a message key when the change didn't go through
    onRename: (name: string) => Promise<'nameTaken' | 'saveFailed' | null>;
    onDelete: () => Promise<boolean>;
    fallbackLabel: string;
}

function CategoryRow(props: CategoryRowProps) {
    const { category, disabled, isTaken, onRename, onDelete, fallbackLabel } = props;
    const t = useTranslations('categoryManager');
    const [mode, setMode] = useState<'view' | 'rename' | 'delete'>('view');
    const [draft, setDraft] = useState(category.name);
    const [error, setError] = useState<'nameTaken' | 'saveFailed' | 'deleteFailed' | null>(null);
    const [busy, setBusy] = useState(false);
    const [opener, setOpener] = useState<'rename' | 'delete'>('rename');

    // Switching modes replaces the button that was pressed, so the focus is handed on by hand: into the new mode,
    // and back to the button that opened it when the mode closes
    const focusTarget = useRef<HTMLElement | null>(null);
    const shownMode = useRef(mode);
    const setFocusTarget = useCallback((element: HTMLElement | null) => {
        focusTarget.current = element;
    }, []);
    useEffect(() => {
        if (shownMode.current !== mode) focusTarget.current?.focus();
        shownMode.current = mode;
    }, [mode]);

    function open(next: 'rename' | 'delete') {
        setOpener(next);
        setDraft(category.name);
        setMode(next);
    }

    function close() {
        setMode('view');
        setError(null);
    }

    async function handleRename(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = draft.trim();
        if (!name) return;
        if (isTaken(name, category.id)) {
            setError('nameTaken');
            return;
        }
        setBusy(true);
        setError(null);
        const failure = await onRename(name);
        setBusy(false);
        if (failure) setError(failure);
        else close();
    }

    async function handleDelete() {
        setBusy(true);
        setError(null);
        const deleted = await onDelete();
        setBusy(false);
        if (!deleted) setError('deleteFailed');
    }

    if (mode === 'rename') {
        return (
            <li className="category-row">
                <form className="category-row__form" onSubmit={(event) => void handleRename(event)}>
                    <input
                        ref={setFocusTarget}
                        className="category-row__input"
                        aria-label={t('renameInput')}
                        autoComplete="off"
                        maxLength={CATEGORY_NAME_MAX_LENGTH}
                        required
                        type="text"
                        value={draft}
                        onChange={(event) => {
                            setDraft(event.target.value);
                            setError(null);
                        }}
                    />
                    <button disabled={disabled || busy} type="submit">
                        {t('save')}
                    </button>
                    <button type="button" onClick={close}>
                        {t('cancel')}
                    </button>
                </form>
                {error && (
                    <p className="category-row__error" role="alert">
                        {t(error)}
                    </p>
                )}
            </li>
        );
    }

    if (mode === 'delete') {
        return (
            <li className="category-row">
                <p className="category-row__question">
                    {t('deleteConfirm', { name: category.name, fallback: fallbackLabel })}
                </p>
                <div className="category-row__actions">
                    <button
                        className="category-row__danger"
                        aria-label={t('deleteItem', { name: category.name })}
                        disabled={disabled || busy}
                        type="button"
                        onClick={() => void handleDelete()}
                    >
                        {t('delete')}
                    </button>
                    <button ref={setFocusTarget} type="button" onClick={close}>
                        {t('cancel')}
                    </button>
                </div>
                {error && (
                    <p className="category-row__error" role="alert">
                        {t(error)}
                    </p>
                )}
            </li>
        );
    }

    return (
        <li className="category-row">
            <span className="category-row__name">{category.name}</span>
            <div className="category-row__actions">
                <button
                    ref={opener === 'rename' ? setFocusTarget : undefined}
                    aria-label={t('renameItem', { name: category.name })}
                    disabled={disabled}
                    type="button"
                    onClick={() => open('rename')}
                >
                    {t('rename')}
                </button>
                <button
                    ref={opener === 'delete' ? setFocusTarget : undefined}
                    className="category-row__danger"
                    aria-label={t('deleteItem', { name: category.name })}
                    disabled={disabled}
                    type="button"
                    onClick={() => open('delete')}
                >
                    {t('delete')}
                </button>
            </div>
        </li>
    );
}

export { CategoryRow };
