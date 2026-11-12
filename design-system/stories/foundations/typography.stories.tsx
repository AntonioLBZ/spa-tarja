import { Brand } from '@/components/brand/brand';

import { tokensWith } from './tokens';

import type { Meta } from '@storybook/react-vite';

import './foundations.css';

const SAMPLE = 'The quick brown fox jumps over the lazy dog 0123456789';

const Story: Meta = {
    title: 'Foundations/Typography',
};

export const Scale = () => {
    return (
        <div>
            {tokensWith('--font-size-')
                .filter((token) => token.name !== '--font-size-logo')
                .map((token) => (
                    <div className="type-sample" key={token.name}>
                        <span className="type-sample__meta">
                            {token.name} · {token.value}
                        </span>
                        <p className="type-sample__text" style={{ fontSize: `var(${token.name})` }}>
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
            {[400, 500, 600, 700, 900].map((weight) => (
                <div className="type-sample" key={weight}>
                    <span className="type-sample__meta">Gabarito · {weight}</span>
                    <p className="type-sample__text" style={{ fontWeight: weight }}>
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
                <span className="type-sample__meta">the logo, in the header</span>
                <Brand />
            </div>
            <div className="type-sample">
                <span className="type-sample__meta">the logo, as the hero</span>
                <Brand size="hero" />
            </div>
        </div>
    );
};

export default Story;
