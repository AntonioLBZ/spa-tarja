import { tokensWith, type Token } from '@stories/shared/tokens';

import type { Meta } from '@storybook/react-vite';
import type { CSSProperties } from 'react';

import './spacing.css';

interface BarsProps {
    tokens: Token[];
}

const Bars = (props: BarsProps) => {
    const { tokens } = props;

    return (
        <div className="spacing-list">
            {tokens.map((token) => (
                <div className="spacing-row" key={token.name}>
                    <span>{token.name}</span>
                    <span className="spacing-row__value">{token.value}</span>
                    <div className="spacing-row__bar" style={{ '--bar': `var(${token.name})` } as CSSProperties} />
                </div>
            ))}
        </div>
    );
};

const Story: Meta = {
    title: 'Foundations/Spacing',
    tags: ['!dev'],
};

export const Scale = () => {
    return <Bars tokens={tokensWith('--size-').filter((token) => token.name !== '--size-touch')} />;
};

export const Touch = () => {
    return <Bars tokens={tokensWith('--size-touch')} />;
};

export const Edges = () => {
    return <Bars tokens={[...tokensWith('--header-'), ...tokensWith('--bottom-nav-')]} />;
};

export default Story;
