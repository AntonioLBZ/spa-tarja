import { useEffect, useRef } from 'react';

// A panel that shows one step at a time, each in place of the button that opened it, hands the focus on by hand: to the
// control a step starts on when it comes, and back to the button that opened it when the first step is back
const useStepFocus = <Step extends string>(step: Step, first: Step) => {
    const openers = useRef(new Map<Step, HTMLElement>());
    const start = useRef<HTMLElement | null>(null);
    const last = useRef(step);

    useEffect(() => {
        if (step !== first) start.current?.focus();
        else if (last.current !== first) openers.current.get(last.current)?.focus();
        last.current = step;
    }, [step, first]);

    return {
        // For the button that opens a step
        opener: (of: Step) => (element: HTMLElement | null) => {
            if (element) openers.current.set(of, element);
        },
        // For the control the step showing starts on
        start: (element: HTMLElement | null) => {
            start.current = element;
        },
    };
};

export { useStepFocus };
