import { skipNextSlide } from './swipe-slide';

// A step back or forward through the history that the browser has already drawn as a slide of its own (the back
// gesture of a phone) shows no slide of the app on top: the screen is already where it was going, and a second slide
// would shake it. The browser's own back button draws none, so it still slides.
const leaveSlidesToTheBrowser = (): (() => void) => {
    const onPopState = (event: PopStateEvent) => {
        if (event.hasUAVisualTransition) skipNextSlide();
    };
    window.addEventListener('popstate', onPopState, { capture: true });
    return () => window.removeEventListener('popstate', onPopState, { capture: true });
};

export { leaveSlidesToTheBrowser };
