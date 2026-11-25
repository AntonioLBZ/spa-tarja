import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { ScreenTitle } from '@/components/screen-title/screen-title';
import { Account } from '@/features/auth/account';
import { YourData } from '@/features/export/your-data';
import { Profile } from '@/features/profile/profile';

import './settings.css';

// The nickname, the data of the account and the session
const AccountPage = () => {
    const t = useTranslations('settings');

    return (
        <section className="settings">
            <ScreenTitle>{t('account.title')}</ScreenTitle>
            <Profile />
            <YourData />
            <Account />
        </section>
    );
};

export const Route = createFileRoute('/settings/account/')({ component: AccountPage });
