import { readDuration } from './motion';
import { beginSwipe, decideSwipe } from './screen-arrival';

import type { SwipeDrag } from './use-swipe';

// How many frames a new screen has to start its slide before the swipe gives up following it
const FRAMES_TO_START = 30;

interface SlideMoves {
    // Opens the new screen, with its slide
    go: () => void;
    // Takes the new screen away again with no slide, once it is out of sight; resolves when the old one is back
    undo: () => Promise<void>;
}

let skipNext = false;

// The next change of screen shows no slide: the screen it goes back to is already in the picture
const skipNextSlide = () => {
    skipNext = true;
};

const takeSkippedSlide = () => {
    const skipped = skipNext;
    skipNext = false;
    return skipped;
};

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

// The slide of a transition that is not the one running before, once it shows up
const newTransition = async (before: ViewTransition | null | undefined) => {
    for (let frame = 0; frame < FRAMES_TO_START; frame++) {
        const transition = document.activeViewTransition;
        if (transition && transition !== before) return transition;
        await nextFrame();
    }
    return null;
};

// The animations a slide already took, which a later slide must not take again
const taken = new WeakSet<Animation>();

// The animations of the pictures of a view transition, each turned to move evenly with the finger. Once turned they no
// longer belong to the styles, so nothing ends them but the slide that took them.
const pictureAnimations = () => {
    const animations = document.getAnimations().filter((animation) => {
        const effect = animation.effect as KeyframeEffect | null;
        return !taken.has(animation) && (effect?.pseudoElement?.startsWith('::view-transition') ?? false);
    });
    for (const animation of animations) {
        taken.add(animation);
        animation.pause();
        const effect = animation.effect as KeyframeEffect;
        effect.setKeyframes(effect.getKeyframes().map((keyframe) => ({ ...keyframe, easing: 'linear' })));
        effect.updateTiming({ easing: 'linear' });
    }
    return animations;
};

const place = (animations: readonly Animation[], progress: number) => {
    for (const animation of animations) {
        const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);
        animation.currentTime = progress * duration;
    }
};

// Out over what is left of the slide's time, decelerating
const easeOut = (share: number) => 1 - (1 - share) ** 3;

// Moves the slide over time, until it gets there or its transition is over
const glide = async (animations: readonly Animation[], from: number, to: number, ms: number, over: () => boolean) => {
    const startedAt = await nextFrame();
    for (let now = startedAt; now - startedAt < ms; now = await nextFrame()) {
        if (over()) return;
        place(animations, from + (to - from) * easeOut((now - startedAt) / ms));
    }
    if (!over()) place(animations, to);
};

// A slide that follows the finger: the new screen is opened as the swipe starts, its view transition is held, and the
// finger sets how far it has gone. Let go of, it goes on to the end, or back to where it started and the old screen is
// opened again under the picture, so nothing is seen to change. Where there are no view transitions, or motion is
// reduced, the screen changes once the finger lifts.
const followSlide = (moves: SlideMoves): SwipeDrag => {
    const { go, undo } = moves;
    const ms = readDuration('--duration-slow');
    beginSwipe();

    if (ms === 0 || typeof document.startViewTransition !== 'function') {
        return {
            follow: () => undefined,
            release: (goOn) => {
                decideSwipe(goOn);
                if (goOn) go();
            },
        };
    }

    let progress = 0;
    let released: boolean | null = null;
    let animations: Animation[] | null = null;
    let transition: ViewTransition | null = null;
    let prepared = false;
    // The transition ended, by itself, skipped or replaced by another one
    let over = false;
    const isOver = () => over;

    const settle = async (goOn: boolean) => {
        if (!transition || !animations) {
            if (!goOn) await undo();
            return;
        }
        if (over) return;
        if (goOn) {
            await glide(animations, progress, 1, ms * (1 - progress), isOver);
            if (!over) for (const animation of animations) animation.finish();
            return;
        }
        await glide(animations, progress, 0, ms * progress, isOver);
        if (over) return;
        await undo();
        await nextFrame();
        transition.skipTransition();
    };

    const before = document.activeViewTransition;
    go();
    void newTransition(before).then(async (started) => {
        transition = started;
        if (started) {
            const ended = () => {
                over = true;
                for (const animation of animations ?? []) animation.cancel();
            };
            started.finished.then(ended, ended);
            await started.ready.catch(() => undefined);
            if (!over) {
                animations = pictureAnimations();
                place(animations, progress);
            }
        }
        prepared = true;
        if (released !== null) await settle(released);
    });

    return {
        follow: (next) => {
            progress = next;
            if (animations && released === null && !over) place(animations, progress);
        },
        release: (goOn) => {
            if (released !== null) return;
            released = goOn;
            decideSwipe(goOn);
            if (prepared) void settle(goOn);
        },
    };
};

export { followSlide, skipNextSlide, takeSkippedSlide, type SlideMoves };
