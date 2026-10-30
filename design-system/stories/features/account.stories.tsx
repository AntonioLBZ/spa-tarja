import { Account as AccountComponent } from '@/features/auth/account';

import { AppData } from './app-data';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/Account',
};

export const Account = () => {
    return <AppData>{() => <AccountComponent />}</AppData>;
};

export default Story;
