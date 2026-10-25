import { describe, expect, it } from 'vitest';

import { slideTypes } from '@/lib/route-transition';

import { createAppRouter } from './router';

describe('createAppRouter', () => {
    it('slides between screens with a view transition', () => {
        expect(createAppRouter().options.defaultViewTransition).toEqual({ types: slideTypes });
    });
});
