import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { followSlide, skipNextSlide, takeSkippedSlide } from './swipe-slide';

const fakeAnimation = (duration: number) => {
    return {
        currentTime: null as number | null,
        effect: {
            pseudoElement: '::view-transition-new(root)',
            getComputedTiming: () => ({ duration }),
            getKeyframes: () => [{ offset: 0, easing: 'ease' }],
            setKeyframes: vi.fn(),
            updateTiming: vi.fn(),
        },
        pause: vi.fn(),
        finish: vi.fn(),
        cancel: vi.fn(),
    };
};

const stubTransition = () => {
    const animations = [fakeAnimation(360), fakeAnimation(200)];
    let end: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
        end = resolve;
    });
    const skipTransition = vi.fn(() => end());
    const transition = { ready: Promise.resolve(), finished, skipTransition };
    const startViewTransition = vi.fn();
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startViewTransition });
    Object.defineProperty(document, 'activeViewTransition', { configurable: true, value: null });
    Object.defineProperty(document, 'getAnimations', { configurable: true, value: () => animations });
    const start = () => {
        Object.defineProperty(document, 'activeViewTransition', { configurable: true, value: transition });
    };
    return { animations, skipTransition, start, end: () => end() };
};

const moves = (start: () => void = () => undefined) => {
    const go = vi.fn(start);
    const undo = vi.fn(() => Promise.resolve());
    return { go, undo };
};

beforeEach(() => {
    document.documentElement.style.setProperty('--duration-slow', '360ms');
});

afterEach(() => {
    document.documentElement.style.removeProperty('--duration-slow');
    for (const name of ['startViewTransition', 'activeViewTransition', 'getAnimations']) {
        Reflect.deleteProperty(document, name);
    }
    takeSkippedSlide();
});

describe('followSlide', () => {
    it('changes the screen only once the finger lifts where there are no view transitions', () => {
        const { go, undo } = moves();
        const drag = followSlide({ go, undo });

        drag.follow(0.5);
        expect(go).not.toHaveBeenCalled();
        drag.release(true);

        expect(go).toHaveBeenCalledOnce();
        expect(undo).not.toHaveBeenCalled();
    });

    it('does the same with reduced motion', () => {
        document.documentElement.style.setProperty('--duration-slow', '0ms');
        stubTransition();
        const { go, undo } = moves();

        followSlide({ go, undo }).release(false);

        expect(go).not.toHaveBeenCalled();
        expect(undo).not.toHaveBeenCalled();
    });

    it('opens the screen at once and holds its slide where the finger is', async () => {
        const { animations, start } = stubTransition();
        const { go, undo } = moves(start);

        const drag = followSlide({ go, undo });
        expect(go).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(animations[0]!.pause).toHaveBeenCalled());
        drag.follow(0.5);

        expect(animations.map((animation) => animation.currentTime)).toEqual([180, 100]);
        expect(animations[0]!.effect.setKeyframes).toHaveBeenCalledWith([{ offset: 0, easing: 'linear' }]);
    });

    it('goes on to the end once let go of', async () => {
        const { animations, skipTransition, start } = stubTransition();
        const { go, undo } = moves(start);
        const drag = followSlide({ go, undo });
        await vi.waitFor(() => expect(animations[0]!.pause).toHaveBeenCalled());

        drag.follow(0.6);
        drag.release(true);

        await vi.waitFor(() => expect(animations[0]!.finish).toHaveBeenCalled());
        expect(undo).not.toHaveBeenCalled();
        expect(skipTransition).not.toHaveBeenCalled();
    });

    it('goes back to where it started, opens the old screen under the picture and only then ends the slide', async () => {
        const { animations, skipTransition, start } = stubTransition();
        const { go, undo } = moves(start);
        const drag = followSlide({ go, undo });
        await vi.waitFor(() => expect(animations[0]!.pause).toHaveBeenCalled());

        drag.follow(0.3);
        drag.release(false);

        await vi.waitFor(() => expect(skipTransition).toHaveBeenCalled());
        expect(undo).toHaveBeenCalledOnce();
        expect(animations.map((animation) => animation.currentTime)).toEqual([0, 0]);
        expect(undo.mock.invocationCallOrder[0]!).toBeLessThan(skipTransition.mock.invocationCallOrder[0]!);
    });

    it('settles a swipe let go of before its slide was ready', async () => {
        const { animations, start } = stubTransition();
        const { go, undo } = moves(start);

        followSlide({ go, undo }).release(true);

        await vi.waitFor(() => expect(animations[0]!.finish).toHaveBeenCalled());
    });

    it('takes the screen away again when no slide came and the swipe went back', async () => {
        stubTransition();
        const { go, undo } = moves();

        followSlide({ go, undo }).release(false);

        await vi.waitFor(() => expect(undo).toHaveBeenCalledOnce(), { timeout: 2000 });
    });
});

describe('followSlide when its transition ends', () => {
    it('ends the animations it took, and stops moving them', async () => {
        const { animations, start, end } = stubTransition();
        const { go, undo } = moves(start);
        const drag = followSlide({ go, undo });
        await vi.waitFor(() => expect(animations[0]!.pause).toHaveBeenCalled());

        end();
        await vi.waitFor(() => expect(animations[0]!.cancel).toHaveBeenCalled());
        drag.follow(0.5);
        drag.release(false);

        expect(animations.map((animation) => animation.currentTime)).toEqual([0, 0]);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(undo).not.toHaveBeenCalled();
    });

    it('never takes the animations another slide took', async () => {
        const { animations, start } = stubTransition();
        followSlide(moves(start));
        await vi.waitFor(() => expect(animations[0]!.pause).toHaveBeenCalledOnce());
        Object.defineProperty(document, 'activeViewTransition', { configurable: true, value: null });

        followSlide(moves(start));
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(animations[0]!.pause).toHaveBeenCalledOnce();
    });
});

describe('skipNextSlide', () => {
    it('skips the slide of the next change of screen only', () => {
        expect(takeSkippedSlide()).toBe(false);
        skipNextSlide();
        expect(takeSkippedSlide()).toBe(true);
        expect(takeSkippedSlide()).toBe(false);
    });
});
