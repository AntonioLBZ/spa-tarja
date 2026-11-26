import { AnnouncerProvider, useAnnounce } from '@/components/announcer/announcer';
import { Button } from '@/components/button/button';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Announcer/Examples',
    component: AnnouncerProvider,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

const AddButton = () => {
    const announce = useAnnounce();

    return <Button onClick={() => announce('Expense added')}>Add</Button>;
};

export const Basic = () => {
    return (
        <AnnouncerProvider>
            <AddButton />
        </AnnouncerProvider>
    );
};

export default Story;
