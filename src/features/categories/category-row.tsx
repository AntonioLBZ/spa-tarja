import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

import { Notice } from '@/components/notice/notice';
import { CATEGORY_NAME_MAX_LENGTH, type Category } from '@core/category';

import { CategoryBadge } from './category-badge';
import { StylePicker } from './style-picker';

import type { CategoryStyle } from '@core/category-style';

import './category-row.css';

interface CategoryRowProps {
    category: Category;
    // Nothing can change without a connection
    disabled: boolean;
    // Whether another category, or a built-in one, already has this name
    isTaken: (name: string, exceptId: string) => boolean;
    // Resolves to a message key when the change didn't go through
    onSave: (changes: { name: string } & CategoryStyle) => Promise<'nameTaken' | 'saveFailed' | null>;
    onDelete: () => Promise<boolean>;
    fallbackLabel: string;
}

// A category the person made. Pressing it opens a panel under it: Edit and Delete, and what each of them needs.
function CategoryRow(props: CategoryRowProps) {
    const { category, disabled, isTaken, onSave, onDelete, fallbackLabel } = props;
    const t = useTranslations('categoryManager');
    const panelId = useId();
    const [expanded, setExpanded] = useState(false);
    const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
    const [draft, setDraft] = useState(category.name);
    const [look, setLook] = useState<CategoryStyle>(category);
    const [error, setError] = useState<'nameTaken' | 'saveFailed' | 'deleteFailed' | null>(null);
    const [busy, setBusy] = useState(false);
    const [opener, setOpener] = useState<'edit' | 'delete'>('edit');

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

    function begin(next: 'edit' | 'delete') {
        setOpener(next);
        setDraft(category.name);
        setLook({ color: category.color, icon: category.icon });
        setMode(next);
    }

    function close() {
        setMode('view');
        setError(null);
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = draft.trim();
        if (!name) return;
        if (isTaken(name, category.id)) {
            setError('nameTaken');
            return;
        }
        setBusy(true);
        setError(null);
        const failure = await onSave({ name, ...look });
        setBusy(false);
        if (failure) {
            setError(failure);
            return;
        }
        close();
        setExpanded(false);
    }

    async function handleDelete() {
        setBusy(true);
        setError(null);
        const deleted = await onDelete();
        setBusy(false);
        if (!deleted) setError('deleteFailed');
    }

    const message = error && (
        <Notice tone="danger" role="alert">
            {t(error)}
        </Notice>
    );

    if (mode === 'edit') {
        return (
            <li className="category-row">
                <form className="category-row__form" onSubmit={(event) => void handleSave(event)}>
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
                    <div className="category-row__panel">
                        <details className="category-row__look">
                            <summary>{t('look.summary')}</summary>
                            <StylePicker name={`${category.id}-look`} value={look} onChange={setLook} />
                        </details>
                        <div className="category-row__actions">
                            <button disabled={disabled || busy} type="submit">
                                {t('save')}
                            </button>
                            <button type="button" onClick={close}>
                                {t('cancel')}
                            </button>
                        </div>
                        {message}
                    </div>
                </form>
            </li>
        );
    }

    return (
        <li className="category-row">
            <button
                className="category-row__toggle"
                aria-controls={expanded ? panelId : undefined}
                aria-expanded={expanded}
                type="button"
                onClick={() => setExpanded(!expanded)}
            >
                <CategoryBadge style={category} />
                <span className="category-row__name">{category.name}</span>
            </button>
            {expanded && (
                <div className="category-row__panel" id={panelId}>
                    {mode === 'delete' ? (
                        <>
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
                            {message}
                        </>
                    ) : (
                        <div className="category-row__actions">
                            <button
                                ref={opener === 'edit' ? setFocusTarget : undefined}
                                aria-label={t('editItem', { name: category.name })}
                                disabled={disabled}
                                type="button"
                                onClick={() => begin('edit')}
                            >
                                {t('edit')}
                            </button>
                            <button
                                ref={opener === 'delete' ? setFocusTarget : undefined}
                                className="category-row__danger"
                                aria-label={t('deleteItem', { name: category.name })}
                                disabled={disabled}
                                type="button"
                                onClick={() => begin('delete')}
                            >
                                {t('delete')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </li>
    );
}

export { CategoryRow };
