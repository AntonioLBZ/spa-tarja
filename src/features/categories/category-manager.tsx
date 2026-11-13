import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { CardList } from '@/components/card/card';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Field } from '@/components/field/field';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { ApiError, categoriesQuery } from '@/lib/api';
import { readDuration } from '@/lib/motion';
import { useOnline } from '@/lib/offline';
import { DEFAULT_CATEGORY_IDS, DEFAULT_CATEGORY_STYLES, FALLBACK_CATEGORY_ID } from '@core/categories';
import { CATEGORY_NAME_MAX_LENGTH, categoryNameKey, type Category } from '@core/category';
import { DEFAULT_CATEGORY_ICON, nextCategoryColor, type CategoryStyle } from '@core/category-style';

import { CategoryBadge } from './category-badge';
import { CategoryRow } from './category-row';
import { StylePicker } from './style-picker';
import { useCategoryActions } from './use-category-actions';

import './category-manager.css';

type Failure = 'nameTaken' | 'saveFailed';

const toFailure = (error: unknown): Failure => {
    return error instanceof ApiError && error.code === 'name-taken' ? 'nameTaken' : 'saveFailed';
};

const CategoryManager = () => {
    const t = useTranslations('categoryManager');
    const tCategory = useTranslations('categories');
    const online = useOnline();
    const query = useQuery(categoriesQuery());
    const { save, remove } = useCategoryActions();
    const id = useId();
    const form = useRef<HTMLFormElement>(null);
    const nameInput = useRef<HTMLInputElement>(null);
    // The toggle of each row of the person's own, to give the focus back to the one that was edited
    const toggles = useRef(new Map<string, HTMLButtonElement>());

    const [name, setName] = useState('');
    const [picked, setPicked] = useState<CategoryStyle | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [saving, setSaving] = useState(false);

    const custom = query.data;
    const editing = custom?.find((category) => category.id === editingId);
    // What the category looks like unless the person picks: while adding, the next free color and the generic icon
    const style: CategoryStyle = picked ?? {
        color: nextCategoryColor((custom ?? []).map((category) => category.color)),
        icon: DEFAULT_CATEGORY_ICON,
    };
    const builtIn = DEFAULT_CATEGORY_IDS.map((categoryId) => tCategory(categoryId));

    // Edit brings the form into view and puts the focus on its field
    useEffect(() => {
        if (editingId === null) return;
        const behavior = readDuration('--duration-base') === 0 ? 'instant' : 'smooth';
        form.current?.scrollIntoView({ behavior, block: 'start' });
        nameInput.current?.focus({ preventScroll: true });
    }, [editingId]);

    // The same name twice, whatever its case, would be two options nobody can tell apart
    const isTaken = (candidate: string, exceptId = '') => {
        const key = categoryNameKey(candidate);
        return (
            builtIn.some((label) => categoryNameKey(label) === key) ||
            (custom ?? []).some((category) => category.id !== exceptId && categoryNameKey(category.name) === key)
        );
    };

    const startEdit = (category: Category) => {
        setEditingId(category.id);
        setName(category.name);
        setPicked({ color: category.color, icon: category.icon });
        setFailure(null);
    };

    // Back to adding, with the focus on the row that was edited
    const finish = (rowId: string | null) => {
        setEditingId(null);
        setName('');
        setPicked(null);
        setFailure(null);
        if (rowId) toggles.current.get(rowId)?.focus();
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        if (isTaken(trimmed, editing?.id)) {
            setFailure('nameTaken');
            return;
        }

        setFailure(null);
        setSaving(true);
        try {
            await save(
                editing ? { ...editing, name: trimmed, ...style } : { id: crypto.randomUUID(), name: trimmed, ...style }
            );
            finish(editing?.id ?? null);
        } catch (error) {
            setFailure(toFailure(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="category-manager">
            <h1 className="category-manager__title">{t('title')}</h1>

            {!online && <Notice role="status">{t('offline')}</Notice>}

            <form className="category-manager__form" ref={form} onSubmit={(event) => void handleSubmit(event)}>
                <Field
                    label={editing ? t('editLabel') : t('add.label')}
                    error={failure && t(failure)}
                    icon={<CategoryBadge style={style} />}
                    actions={
                        <Button disabled={!online || saving} type="submit">
                            {editing ? t('save') : t('add.submit')}
                        </Button>
                    }
                >
                    {(control) => (
                        <input
                            {...control}
                            ref={nameInput}
                            // A save that went wrong is not the fault of the name
                            aria-invalid={failure === 'nameTaken'}
                            autoComplete="off"
                            disabled={!online}
                            maxLength={CATEGORY_NAME_MAX_LENGTH}
                            required
                            type="text"
                            value={name}
                            onChange={(event) => {
                                setName(event.target.value);
                                setFailure(null);
                            }}
                        />
                    )}
                </Field>
                <Disclosure key={editing?.id ?? 'new'} summary={t('look.summary')} chevron>
                    <StylePicker name={`${id}-look`} value={style} onChange={setPicked} />
                </Disclosure>
                {editing && (
                    <Button ghost className="category-manager__cancel" onClick={() => finish(editing.id)}>
                        {t('cancel')}
                    </Button>
                )}
            </form>

            {query.isError && custom === undefined && (
                <Notice tone="danger" role="alert">
                    {t('loadFailed')}
                </Notice>
            )}
            {custom?.length === 0 && <Notice tone="quiet">{t('custom.empty')}</Notice>}
            {custom && custom.length > 0 && (
                <Sheet label={t('custom.title')}>
                    <CardList flush>
                        {custom.map((category) => (
                            <CategoryRow
                                key={category.id}
                                category={category}
                                disabled={!online}
                                fallbackLabel={tCategory(FALLBACK_CATEGORY_ID)}
                                toggleRef={(node) => {
                                    if (node) toggles.current.set(category.id, node);
                                    return () => {
                                        toggles.current.delete(category.id);
                                    };
                                }}
                                onEdit={() => startEdit(category)}
                                onDelete={() =>
                                    remove(category.id).then(
                                        () => true,
                                        () => false
                                    )
                                }
                            />
                        ))}
                    </CardList>
                </Sheet>
            )}

            <section className="category-manager__section">
                <p className="category-manager__hint">{t('builtIn.note')}</p>
                <Sheet label={t('builtIn.title')}>
                    <CardList flush>
                        {DEFAULT_CATEGORY_IDS.map((categoryId) => (
                            <li className="category-manager__built-in" key={categoryId}>
                                <CategoryBadge style={DEFAULT_CATEGORY_STYLES[categoryId]} />
                                <span>{tCategory(categoryId)}</span>
                            </li>
                        ))}
                    </CardList>
                </Sheet>
            </section>
        </section>
    );
};

export { CategoryManager };
