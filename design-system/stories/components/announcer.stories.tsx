import { AnnouncerProvider, useAnnounce } from '@/components/announcer/announcer';
import { Button } from '@/components/button/button';

import type { Meta } from '@storybook/react-vite';

interface AnnouncerStoryProps {
    message: string;
}

const SayButton = (props: AnnouncerStoryProps) => {
    const { message } = props;
    const announce = useAnnounce();

    return <Button onClick={() => announce(message)}>Say it</Button>;
};

const Story: Meta<AnnouncerStoryProps> = {
    title: 'Components/Announcer',
    args: { message: 'Expense added' },
    argTypes: { message: { control: 'text' } },
};

export const Announcer = (args: AnnouncerStoryProps) => {
    return (
        <AnnouncerProvider>
            <SayButton {...args} />
            <p className="hint">The message is read by a screen reader and shown nowhere.</p>
        </AnnouncerProvider>
    );
};

export default Story;
