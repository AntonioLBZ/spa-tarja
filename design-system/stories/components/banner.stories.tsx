import { BannerProvider, useBanner } from '@/components/banner/banner';
import { Button } from '@/components/button/button';
import { Card, CardList } from '@/components/card/card';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

interface BannerStoryProps {
    title: string;
    message: string;
    // The text a second notice that comes while it shows puts in it
    summary: string;
    onOpen: () => void;
}

// A screen to read the banner over: a header and a list of expenses, as long as a phone
const PAGE = Array.from({ length: 12 }, (_, index) => ({
    name: ['Supermarket', 'Bakery', 'Dinner at Lola', 'Bus pass', 'Cinema', 'Rent'][index % 6]!,
    amount: `${(index * 7.35 + 3.8).toFixed(2)} €`,
}));

const BannerPage = () => {
    return (
        <>
            <div
                style={{
                    background: 'var(--color-bg-secondary)',
                    borderBottom: 'var(--size-px) solid var(--color-border)',
                    height: 'var(--header-height)',
                    padding: 'var(--size-3) var(--size-4)',
                }}
            >
                Expenses
            </div>
            <div style={{ padding: 'var(--size-4)' }}>
                <CardList as="ul" label="November">
                    {PAGE.map((item, index) => (
                        <Card key={index} as="li">
                            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{item.name}</span>
                                <span>{item.amount}</span>
                            </span>
                        </Card>
                    ))}
                </CardList>
            </div>
        </>
    );
};

const BannerButtons = (props: BannerStoryProps) => {
    const { title, message, summary, onOpen } = props;
    const banner = useBanner();

    return (
        <div
            style={{
                background: 'var(--color-bg-primary)',
                bottom: 0,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--size-4)',
                insetInline: 0,
                padding: 'var(--size-4)',
                position: 'fixed',
            }}
        >
            <Button onClick={() => banner.show({ title, message, onOpen })}>Show</Button>
            <Button onClick={() => banner.show({ title, message: summary, onOpen })}>Another one</Button>
            <Button onClick={() => banner.dismiss()}>Dismiss</Button>
        </div>
    );
};

const Story: Meta<BannerStoryProps> = {
    title: 'Components/Banner',
    args: {
        title: 'Flat',
        message: 'Ana added Dinner · your part €6.25',
        summary: '2 new expenses',
        onOpen: fn(),
    },
    argTypes: { title: { control: 'text' }, message: { control: 'text' }, summary: { control: 'text' } },
    parameters: { layout: 'fullscreen' },
};

export const Banner = (args: BannerStoryProps) => {
    return (
        <BannerProvider dismissLabel="Dismiss">
            <BannerPage />
            <BannerButtons {...args} />
        </BannerProvider>
    );
};

export default Story;
