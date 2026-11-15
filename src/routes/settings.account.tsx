import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Account } from '@/features/auth/account';
import { YourData } from '@/features/export/your-data';
import { Profile } from '@/features/profile/profile';

import './settings.css';

// The nickname, the data of the account and the session
const AccountPage = () => {
    const t = useTranslations('settings');

    return (
        <section className="settings">
            <h1 className="settings__title">{t('account.title')}</h1>
            <Profile />
            <YourData />
            <Account />
        </section>
    );
};

export const Route = createFileRoute('/settings/account')({ component: AccountPage });
