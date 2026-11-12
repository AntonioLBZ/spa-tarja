import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';

import { useOpenAdd } from './use-open-add';

import './add-expense-button.css';

// The "+" from 40 rem up, as a text action in the header; on a phone it is in the bar
const AddExpenseButton = () => {
    const t = useTranslations('nav');
    const openAdd = useOpenAdd();

    return (
        <Button ghost className="add-expense-button" aria-haspopup="dialog" onClick={openAdd}>
            {t('add')}
        </Button>
    );
};

export { AddExpenseButton };
