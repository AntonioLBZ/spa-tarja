import { useEffect, useRef, useState, type Ref } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Disclosure } from '@/components/disclosure/disclosure';
import { Notice } from '@/components/notice/notice';

import { CategoryBadge } from './category-badge';

import type { Category } from '@core/category';

import './category-row.css';

interface CategoryRowProps {
    category: Category;
    // Nothing can change without a connection
    disabled: boolean;
    fallbackLabel: string;
    // Loads the category into the form that adds one
    onEdit: () => void;
    onDelete: () => Promise<boolean>;
    toggleRef?: Ref<HTMLButtonElement>;
}

// A category the person made, on a sheet. Pressing it opens Edit and Delete under it; Delete asks first.
const CategoryRow = (props: CategoryRowProps) => {
    const { category, disabled, fallbackLabel, onEdit, onDelete, toggleRef } = props;
    const t = useTranslations('categoryManager');
    const [expanded, setExpanded] = useState(false);
    const [asking, setAsking] = useState(false);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);

    // Switching to the question replaces the button that was pressed, so the focus is handed on by hand: into the
    // question, and back to Delete when it closes
    const deleteButton = useRef<HTMLButtonElement>(null);
    const cancelButton = useRef<HTMLButtonElement>(null);
    const wasAsking = useRef(false);
    useEffect(() => {
        if (asking) cancelButton.current?.focus();
        else if (wasAsking.current) deleteButton.current?.focus();
        wasAsking.current = asking;
    }, [asking]);

    const handleOpenChange = (open: boolean) => {
        setExpanded(open);
        if (!open) {
            setAsking(false);
            setFailed(false);
        }
    };

    const handleEdit = () => {
        setExpanded(false);
        onEdit();
    };

    const handleDelete = async () => {
        setBusy(true);
        setFailed(false);
        const deleted = await onDelete();
        setBusy(false);
        if (!deleted) setFailed(true);
    };

    return (
        <Disclosure
            as="li"
            chevron
            summary={
                <>
                    <CategoryBadge style={category} />
                    <span className="category-row__name">{category.name}</span>
                </>
            }
            open={expanded}
            toggleRef={toggleRef}
            onOpenChange={handleOpenChange}
        >
            {asking ? (
                <>
                    <p className="category-row__question">
                        {t('deleteConfirm', { name: category.name, fallback: fallbackLabel })}
                    </p>
                    <div className="category-row__actions">
                        <Button
                            ghost
                            variant="danger"
                            aria-label={t('deleteItem', { name: category.name })}
                            disabled={disabled || busy}
                            onClick={() => void handleDelete()}
                        >
                            {t('delete')}
                        </Button>
                        <Button ghost ref={cancelButton} onClick={() => setAsking(false)}>
                            {t('cancel')}
                        </Button>
                    </div>
                    {failed && (
                        <Notice tone="danger" role="alert">
                            {t('deleteFailed')}
                        </Notice>
                    )}
                </>
            ) : (
                <div className="category-row__actions">
                    <Button
                        ghost
                        aria-label={t('editItem', { name: category.name })}
                        disabled={disabled}
                        onClick={handleEdit}
                    >
                        {t('edit')}
                    </Button>
                    <Button
                        ghost
                        ref={deleteButton}
                        variant="danger"
                        aria-label={t('deleteItem', { name: category.name })}
                        disabled={disabled}
                        onClick={() => setAsking(true)}
                    >
                        {t('delete')}
                    </Button>
                </div>
            )}
        </Disclosure>
    );
};

export { CategoryRow, type CategoryRowProps };
