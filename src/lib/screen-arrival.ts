// What the heading of a screen does when its screen opens: take the focus, say its text, or say it once the swipe that
// opened it is decided. Whoever knows how the screen was reached (the router) sets it, and the heading takes it when it
// appears.
type Arrival = 'focus' | 'announce' | 'hold';

// A screen that waits for its data can show its heading late; after this long the change of screen is over and a
// heading that appears is not its arrival
const ARRIVAL_MS = 2_000;

let expected: { how: Arrival; until: number } | null = null;

const expectArrival = (how: Arrival) => {
    expected = { how, until: Date.now() + ARRIVAL_MS };
};

const takeArrival = (): Arrival | null => {
    const arrival = expected && expected.until > Date.now() ? expected.how : null;
    expected = null;
    return arrival;
};

// A change of screen that a swipe made counts as one made from the bar of destinations: the focus stays. The mark goes
// with the change it was made for.
const SWIPE_MS = 1_000;

let swipedAt = -Infinity;

const markSwiped = () => {
    swipedAt = Date.now();
};

const takeSwiped = () => {
    const was = Date.now() - swipedAt < SWIPE_MS;
    swipedAt = -Infinity;
    return was;
};

// A swipe that went back, which makes the change of screen after it: the screen it returns to is the one the person
// never left, so nothing is said of it. The mark goes with the change it was made for.
let undoneAt = -Infinity;

const markUndone = () => {
    undoneAt = Date.now();
};

const takeUndone = () => {
    const was = Date.now() - undoneAt < SWIPE_MS;
    undoneAt = -Infinity;
    return was;
};

// A swipe opens its screen while the finger is still down, so it is known only when the finger lifts whether the
// person is on that screen: what is said of it waits for that, and a swipe that goes back says nothing. Where no swipe
// is deciding, it is said at once.
let verdict: boolean | null = true;
let waiting: (() => void) | null = null;

const beginSwipe = () => {
    verdict = null;
    waiting = null;
};

const decideSwipe = (goOn: boolean) => {
    verdict = goOn;
    const say = waiting;
    waiting = null;
    if (goOn) say?.();
};

const sayWhenSwipeIsDecided = (say: () => void) => {
    if (verdict === null) waiting = say;
    else if (verdict) say();
};

// The heading of the screen that is showing
let heading: HTMLElement | null = null;

const showHeading = (element: HTMLElement | null) => {
    heading = element;
};

const focusHeading = (options?: FocusOptions) => {
    heading?.focus(options);
};

export {
    beginSwipe,
    decideSwipe,
    expectArrival,
    focusHeading,
    markSwiped,
    markUndone,
    sayWhenSwipeIsDecided,
    showHeading,
    takeArrival,
    takeSwiped,
    takeUndone,
    type Arrival,
};
