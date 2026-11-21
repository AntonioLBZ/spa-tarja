import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

import { expectArrival, takeSwiped, takeUndone } from './screen-arrival';

// The focus stays on a control of the navigation that is always in the page (the bar, the header, the tabs of
// Expenses), which is a place of its own
const KEEPS_FOCUS = 'nav, [data-keeps-focus]';

// Tells the heading of the screen that opens how it was reached. From the first load or a change of the address that
// is not a change of screen, it does nothing. A step through the history, or a change from the always-there
// navigation or a swipe, leaves the focus where it is and says the new screen, a swiped one once its swipe is
// decided. Any other change (a card, a button, an action that goes somewhere) moves the focus to the heading, which is
// what the control that was pressed no longer is. The change that takes a cancelled swipe back says nothing.
const useScreenArrivals = () => {
    const router = useRouter();

    useEffect(() => {
        let traversal = false;
        let replacing = false;
        let keepsFocus = false;
        let swiped = false;
        let undone = false;

        const offHistory = router.history.subscribe(({ action }) => {
            traversal = action.type !== 'PUSH' && action.type !== 'REPLACE';
            replacing = action.type === 'REPLACE';
            swiped = takeSwiped();
            undone = takeUndone();
            keepsFocus = swiped || document.activeElement?.closest(KEEPS_FOCUS) != null;
        });

        const offMount = router.subscribe('onBeforeRouteMount', ({ fromLocation, hrefChanged, pathChanged }) => {
            if (!fromLocation || !hrefChanged || undone) return;
            const says = swiped ? 'hold' : 'announce';
            if (traversal || (!pathChanged && !replacing)) expectArrival(says);
            else if (pathChanged) expectArrival(keepsFocus ? says : 'focus');
        });

        return () => {
            offHistory();
            offMount();
        };
    }, [router]);
};

export { useScreenArrivals };
