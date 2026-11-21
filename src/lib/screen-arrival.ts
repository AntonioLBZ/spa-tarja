// What the heading of a screen does when its screen opens: take the focus, or say its text. Whoever knows how the
// screen was reached (the router) sets it, and the heading takes it when it appears.
type Arrival = 'focus' | 'announce';

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

// The heading of the screen that is showing
let heading: HTMLElement | null = null;

const showHeading = (element: HTMLElement | null) => {
    heading = element;
};

const focusHeading = (options?: FocusOptions) => {
    heading?.focus(options);
};

export { expectArrival, focusHeading, markSwiped, showHeading, takeArrival, takeSwiped, type Arrival };
