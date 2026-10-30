import { Button } from '@/components/button/button';
import clsx from 'clsx';
import { useState, type CSSProperties } from 'react';

import { tokensWith } from './tokens';

import type { Meta } from '@storybook/react-vite';

import './foundations.css';

const Story: Meta = {
    title: 'Foundations/Motion',
};

export const Durations = () => {
    const [moved, setMoved] = useState(false);
    const durations = tokensWith('--duration-');
    const eases = tokensWith('--ease-');
    const gridClsx = clsx('motion-grid', { 'motion-grid--moved': moved });

    return (
        <div>
            <Button onClick={() => setMoved(!moved)}>Play</Button>
            <div className={gridClsx} style={{ marginBlock: 'var(--size-4)' }}>
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
};

export default Story;
