import { tokensWith } from './tokens';

import type { Meta } from '@storybook/react-vite';

import './foundations.css';

const Story: Meta = {
    title: 'Foundations/Spacing',
};

export const Scale = () => {
    return (
        <div>
            {tokensWith('--size-').map((token) => (
                <div className="spacing-row" key={token.name}>
                    <span>{token.name}</span>
                    <span className="spacing-row__value">{token.value}</span>
                    <div className="spacing-row__bar" style={{ inlineSize: `var(${token.name})` }} />
                </div>
            ))}
        </div>
    );
};

export default Story;
