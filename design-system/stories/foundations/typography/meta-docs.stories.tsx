import { Brand } from '@/components/brand/brand';
import { tokensWith } from '@stories/shared/tokens';

import type { Meta } from '@storybook/react-vite';
import type { CSSProperties } from 'react';

import './typography.css';

const SAMPLE = 'The quick brown fox jumps over the lazy dog 0123456789';

const WEIGHTS = [400, 700];

const Story: Meta = {
    title: 'Foundations/Typography',
    tags: ['!dev'],
};

export const Families = () => {
    return (
        <div>
            {tokensWith('--font-family').map((token) => (
                <div className="type-sample" key={token.name}>
                    <span className="type-sample__meta">
                        {token.name} · {token.value}
                    </span>
                    <p
                        className="type-sample__text"
                        style={{ '--sample-family': `var(${token.name})` } as CSSProperties}
                    >
                        {token.name === '--font-family-brand' ? 'Tarja' : SAMPLE}
                    </p>
                </div>
            ))}
        </div>
    );
};

export const Sizes = () => {
    return (
        <div>
            {tokensWith('--font-size-')
                .filter((token) => token.name !== '--font-size-logo')
                .map((token) => (
                    <div className="type-sample" key={token.name}>
                        <span className="type-sample__meta">
                            {token.name} · {token.value}
                        </span>
                        <p
                            className="type-sample__text"
                            style={{ '--sample-size': `var(${token.name})` } as CSSProperties}
                        >
                            {SAMPLE}
                        </p>
                    </div>
                ))}
        </div>
    );
};

export const Weights = () => {
    return (
        <div>
            {WEIGHTS.map((weight) => (
                <div className="type-sample" key={weight}>
                    <span className="type-sample__meta">IBM Plex Mono · {weight}</span>
                    <p className="type-sample__text" style={{ '--sample-weight': weight } as CSSProperties}>
                        {SAMPLE}
                    </p>
                </div>
            ))}
        </div>
    );
};

export const Logo = () => {
    return (
        <div>
            <div className="type-sample">
                <span className="type-sample__meta">In the header</span>
                <Brand />
            </div>
            <div className="type-sample">
                <span className="type-sample__meta">--font-size-logo, as the hero</span>
                <Brand size="hero" />
            </div>
        </div>
    );
};

export default Story;
