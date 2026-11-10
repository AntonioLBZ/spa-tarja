import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';

import { useOpenAdd } from './use-open-add';

import './add-expense-button.css';

// The "+" from 40 rem up, floating at the lower-right corner of the content column; on a phone it is in the bar
const AddExpenseButton = () => {
    const t = useTranslations('nav');
    const openAdd = useOpenAdd();

    return (
        <Button
            variant="primary"
            glyph
            className="add-expense-button"
            aria-haspopup="dialog"
            aria-label={t('add')}
            onClick={openAdd}
        >
            <Icon name="add" />
        </Button>
    );
};

export { AddExpenseButton };
