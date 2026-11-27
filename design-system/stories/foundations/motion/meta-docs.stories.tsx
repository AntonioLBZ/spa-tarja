import { Button } from '@/components/button/button';
import { tokensWith, type Token } from '@stories/shared/tokens';
import clsx from 'clsx';
import { useState, type CSSProperties } from 'react';

import type { Meta } from '@storybook/react-vite';

import './motion.css';

interface TracksProps {
    tokens: Token[];
    // What each track moves with, besides its token
    style: (token: Token) => CSSProperties;
}

const Tracks = (props: TracksProps) => {
    const { tokens, style } = props;
    const [moved, setMoved] = useState(false);
    const tracksClsx = clsx('motion-tracks', { 'motion-tracks--moved': moved });

    return (
        <div className={tracksClsx}>
            <Button onClick={() => setMoved(!moved)}>Play</Button>
            {tokens.map((token) => (
                <div className="motion-row" key={token.name}>
                    <span className="motion-row__name">
                        {token.name} · {token.value}
                    </span>
                    <div className="motion-row__track">
                        <div className="motion-row__dot" style={style(token)} />
                    </div>
                </div>
            ))}
        </div>
    );
};

const Story: Meta = {
    title: 'Foundations/Motion',
    tags: ['!dev'],
};

export const Durations = () => {
    return (
        <Tracks
            tokens={tokensWith('--duration-')}
            style={(token) =>
                ({ '--demo-duration': `var(${token.name})`, '--demo-ease': 'var(--ease-standard)' }) as CSSProperties
            }
        />
    );
};

export const Easings = () => {
    return (
        <Tracks
            tokens={tokensWith('--ease-')}
            style={(token) =>
                ({ '--demo-duration': 'var(--duration-slow)', '--demo-ease': `var(${token.name})` }) as CSSProperties
            }
        />
    );
};

export default Story;
