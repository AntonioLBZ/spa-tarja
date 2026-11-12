import { HeroStat as HeroStatComponent, type HeroStatProps } from '@/components/hero-stat/hero-stat';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<HeroStatProps> = {
    title: 'Components/HeroStat',
    component: HeroStatComponent,
    args: {
        label: 'Spent in November',
        amount: { value: 123456, format: (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €` },
        sub: 'of your 1.500,00 € limit · 264,44 € left',
        size: 'hero',
    },
    argTypes: { size: { control: 'inline-radio', options: ['hero', 'title'] }, amount: { control: false } },
};

export const HeroStat = (args: HeroStatProps) => {
    return <HeroStatComponent {...args} />;
};

export default Story;
