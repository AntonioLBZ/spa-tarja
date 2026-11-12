import { useRef } from 'react';

import { DURATION, EASE, MOTION_QUERY, canAnimate, gsap, useGSAP } from '@/lib/motion/gsap';

interface CountUpProps {
    // A whole number, such as an amount in cents
    value: number;
    // How the number reads; the figures are tabular, so the text doesn't jitter while it counts
    format: (value: number) => string;
    className?: string;
}

// A number that rolls from what it showed to what it is now: from zero the first time it is drawn
const CountUp = (props: CountUpProps) => {
    const { value, format, className } = props;
    const ref = useRef<HTMLSpanElement>(null);
    const shown = useRef<number | null>(null);

    useGSAP(
        () => {
            const node = ref.current?.firstChild;
            if (!node || !canAnimate()) {
                shown.current = value;
                return;
            }
            const mm = gsap.matchMedia();
            mm.add(MOTION_QUERY, () => {
                const first = shown.current === null;
                const state = { amount: shown.current ?? 0 };
                node.nodeValue = format(Math.round(state.amount));
                const tween = gsap.to(state, {
                    amount: value,
                    duration: first ? DURATION.slow * 2.4 : DURATION.slow * 1.6,
                    ease: EASE.enter,
                    onUpdate: () => {
                        shown.current = state.amount;
                        node.nodeValue = format(Math.round(state.amount));
                    },
                });
                return () => {
                    tween.kill();
                    node.nodeValue = format(value);
                    shown.current = value;
                };
            });
            return () => mm.revert();
        },
        { dependencies: [value] }
    );

    return (
        <span ref={ref} className={className}>
            {format(value)}
        </span>
    );
};

export { CountUp, type CountUpProps };
