import { describe, expect, it } from 'vitest';

import { skipNextSlide } from '@/lib/navigation';
import { createAppRouter } from '@/router';

const change = (from: string, to: string) => {
    return {
        fromLocation: { pathname: from } as never,
        toLocation: { pathname: to } as never,
        pathChanged: true,
        hrefChanged: true,
        hashChanged: false,
    };
};

const typesOf = () => {
    const transition = createAppRouter().options.defaultViewTransition;
    if (typeof transition !== 'object' || typeof transition.types !== 'function') throw new Error('No slide types');
    return transition.types;
};

describe('createAppRouter', () => {
    it('slides between screens with a view transition', () => {
        expect(typesOf()(change('/', '/groups'))).toEqual(['next']);
    });

    it('skips the slide of the one change a swipe asked it to', () => {
        const types = typesOf();

        skipNextSlide();

        expect(types(change('/groups', '/'))).toBe(false);
        expect(types(change('/groups', '/'))).toEqual(['previous']);
    });
});
