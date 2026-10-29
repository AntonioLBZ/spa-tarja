import { Button } from '@/components/button/button';
import { useState, type CSSProperties } from 'react';

import { tokensWith } from './tokens';

import type { Meta, StoryObj } from '@storybook/react-vite';

import './foundations.css';

function MotionGrid() {
    const [moved, setMoved] = useState(false);
    const durations = tokensWith('--duration-');
    const eases = tokensWith('--ease-');

    return (
        <div>
            <Button onClick={() => setMoved(!moved)}>Play</Button>
            <div
                className={moved ? 'motion-grid motion-grid--moved' : 'motion-grid'}
                style={{ marginBlock: 'var(--size-4)' }}
            >
                <span />
                {durations.map((duration) => (
                    <span className="motion-grid__head" key={duration.name}>
                        {duration.name} · {duration.value}
                    </span>
                ))}
                {eases.map((ease) => (
                    <div style={{ display: 'contents' }} key={ease.name}>
                        <span className="motion-grid__head">{ease.name}</span>
                        {durations.map((duration) => (
                            <div className="motion-track" key={duration.name}>
                                <div
                                    className="motion-dot"
                                    style={
                                        {
                                            '--demo-duration': `var(${duration.name})`,
                                            '--demo-ease': `var(${ease.name})`,
                                        } as CSSProperties
                                    }
                                />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <p className="motion-note">
                With reduced motion on, the durations are 0 and the squares jump instead of sliding. Only transform and
                opacity are animated.
            </p>
        </div>
    );
}

const meta = {
    title: 'Foundations/Motion',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Durations: Story = {
    render: () => <MotionGrid />,
};

export default meta;
export { Durations };
