import { useQuery } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

import { Notice } from '@/components/notice/notice';
import { ApiError, categoriesQuery } from '@/lib/api';
import { useOnline } from '@/lib/offline';
import { DEFAULT_CATEGORY_IDS, DEFAULT_CATEGORY_STYLES, FALLBACK_CATEGORY_ID } from '@core/categories';
import { CATEGORY_NAME_MAX_LENGTH, categoryNameKey } from '@core/category';
import { DEFAULT_CATEGORY_ICON, nextCategoryColor, type CategoryStyle } from '@core/category-style';

import { CategoryBadge } from './category-badge';
import { CategoryRow } from './category-row';
import { StylePicker } from './style-picker';
import { useCategoryActions } from './use-category-actions';

import './category-manager.css';

type Failure = 'nameTaken' | 'saveFailed';

function toFailure(error: unknown): Failure {
    return error instanceof ApiError && error.code === 'name-taken' ? 'nameTaken' : 'saveFailed';
}

function CategoryManager() {
    const t = useTranslations('categoryManager');
    const tCategory = useTranslations('categories');
    const online = useOnline();
    const query = useQuery(categoriesQuery());
    const { save, remove } = useCategoryActions();
    const id = useId();

    const [name, setName] = useState('');
    const [picked, setPicked] = useState<CategoryStyle | null>(null);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [saving, setSaving] = useState(false);

    const custom = query.data;
    // What the new category looks like unless the person picks: the next free color and the generic icon
    const style: CategoryStyle = picked ?? {
        color: nextCategoryColor((custom ?? []).map((category) => category.color)),
        icon: DEFAULT_CATEGORY_ICON,
    };
    const builtIn = DEFAULT_CATEGORY_IDS.map((categoryId) => tCategory(categoryId));

    // The same name twice, whatever its case, would be two options nobody can tell apart
    function isTaken(candidate: string, exceptId = '') {
        const key = categoryNameKey(candidate);
        return (
            builtIn.some((label) => categoryNameKey(label) === key) ||
            (custom ?? []).some((category) => category.id !== exceptId && categoryNameKey(category.name) === key)
        );
    }

    async function handleAdd(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        if (isTaken(trimmed)) {
            setFailure('nameTaken');
            return;
        }

        setFailure(null);
        setSaving(true);
        try {
            await save({ id: crypto.randomUUID(), name: trimmed, ...style });
            setName('');
            setPicked(null);
        } catch (error) {
            setFailure(toFailure(error));
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="category-manager">
            <h1 className="category-manager__title">{t('title')}</h1>

            {!online && <Notice role="status">{t('offline')}</Notice>}

            <form className="category-manager__add" onSubmit={(event) => void handleAdd(event)}>
                <label htmlFor={`${id}-name`}>{t('add.label')}</label>
                <div className="category-manager__add-row">
                    <CategoryBadge style={style} />
                    <input
                        className="category-manager__input"
                        id={`${id}-name`}
                        aria-describedby={failure ? `${id}-error` : undefined}
                        aria-invalid={failure === 'nameTaken'}
                        autoComplete="off"
                        maxLength={CATEGORY_NAME_MAX_LENGTH}
                        required
                        type="text"
                        value={name}
                        onChange={(event) => {
                            setName(event.target.value);
                            setFailure(null);
                        }}
                    />
                    <button disabled={!online || saving} type="submit">
                        {t('add.submit')}
                    </button>
                </div>
                <details className="category-manager__look">
                    <summary>{t('look.summary')}</summary>
                    <StylePicker name={`${id}-look`} value={style} onChange={setPicked} />
                </details>
                {failure && (
                    <Notice tone="danger" role="alert" id={`${id}-error`}>
                        {t(failure)}
                    </Notice>
                )}
            </form>

            <section className="category-manager__section">
                <h2 className="category-manager__heading">{t('custom.title')}</h2>
                {query.isError && custom === undefined && (
                    <p className="category-manager__hint" role="alert">
                        {t('loadFailed')}
                    </p>
                )}
                {custom?.length === 0 && <p className="category-manager__hint">{t('custom.empty')}</p>}
                <ul className="category-manager__list">
                    {custom?.map((category) => (
                        <CategoryRow
                            key={category.id}
                            category={category}
                            disabled={!online}
                            fallbackLabel={tCategory(FALLBACK_CATEGORY_ID)}
                            isTaken={isTaken}
                            onDelete={() =>
                                remove(category.id).then(
                                    () => true,
                                    () => false
                                )
                            }
                            onSave={(changes) =>
                                save({ ...category, ...changes }).then(
                                    () => null,
                                    (error: unknown) => toFailure(error)
                                )
                            }
                        />
                    ))}
                </ul>
            </section>

            <section className="category-manager__section">
                <h2 className="category-manager__heading">{t('builtIn.title')}</h2>
                <p className="category-manager__hint">{t('builtIn.note')}</p>
                <ul className="category-manager__list">
                    {DEFAULT_CATEGORY_IDS.map((categoryId) => (
                        <li className="category-manager__built-in" key={categoryId}>
                            <CategoryBadge style={DEFAULT_CATEGORY_STYLES[categoryId]} />
                            <span>{tCategory(categoryId)}</span>
                        </li>
                    ))}
                </ul>
            </section>
        </section>
    );
}

export { CategoryManager };
