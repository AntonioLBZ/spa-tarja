import { Button } from '@/components/button/button';
import { ScrollStrip as ScrollStripComponent, type ScrollStripProps } from '@/components/scroll-strip/scroll-strip';

import type { Meta } from '@storybook/react-vite';

const THINGS = ['All', 'Food', 'Groceries', 'Leisure', 'Bills', 'Housing', 'Transport', 'Health', 'Pets', 'Gifts'];

const Story: Meta<ScrollStripProps> = {
    title: 'Components/ScrollStrip',
    component: ScrollStripComponent,
    args: { bleed: false },
};

// Narrow the canvas, or add things, until the row doesn't fit: the edge with more past it fades and, with a mouse, an
// arrow takes the row along
export const ScrollStrip = (args: ScrollStripProps) => {
    return (
        <div style={{ maxInlineSize: '28rem' }}>
            <ScrollStripComponent {...args} role="group" aria-label="Categories">
                {THINGS.map((thing, index) => (
                    <Button key={thing} className="chip" pressed={index === 0} style={{ flex: 'none' }}>
                        {thing}
                    </Button>
                ))}
            </ScrollStripComponent>
        </div>
    );
};

export default Story;
