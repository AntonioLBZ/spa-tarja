import { ButtonLink } from '@/components/button/button-link';
import { Icon } from '@/components/icon/icon';
import { RouterFrame } from '@stories/shared/router-frame';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/ButtonLink/Examples',
    component: ButtonLink,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
    decorators: [
        (Story) => (
            <RouterFrame paths={['/settings', '/settings/account/print']}>
                <Story />
            </RouterFrame>
        ),
    ],
};

export const Basic = () => {
    return (
        <ButtonLink to="/settings/account/print" block>
            Printable view
        </ButtonLink>
    );
};

export const Back = () => {
    return (
        <ButtonLink to="/settings" ghost small aria-label="Back to Settings">
            <Icon name="chevron_left" />
            Settings
        </ButtonLink>
    );
};

export default Story;
