import { useRef } from 'react';

import { DURATION, EASE, MOTION_QUERY, canAnimate, gsap, useGSAP } from '@/lib/motion/gsap';

import './tally-mark.css';

interface TallyMarkProps {
    className?: string;
}

// A tally of five, the mark the name of the app comes from: four bars and a slash across them, which draw themselves one
// after the other when it comes in. It says nothing the words don't, so it is hidden from assistive technology.
const TallyMark = (props: TallyMarkProps) => {
    const { className } = props;
    const root = useRef<SVGSVGElement>(null);

    useGSAP(
        () => {
            const bars = root.current?.querySelectorAll('.tally-mark__bar');
            const slash = root.current?.querySelector('.tally-mark__slash');
            if (!bars?.length || !slash || !canAnimate()) return;
            const mm = gsap.matchMedia();
            mm.add(MOTION_QUERY, () => {
                gsap.timeline({ delay: 0.35 })
                    .from(bars, {
                        scaleY: 0,
                        transformOrigin: '50% 100%',
                        duration: DURATION.slow,
                        ease: EASE.spring,
                        stagger: 0.14,
                    })
                    .from(slash, {
                        scaleX: 0,
                        transformOrigin: '0% 50%',
                        duration: DURATION.slow * 1.4,
                        ease: EASE.enter,
                    });
            });
            return () => mm.revert();
        },
        { scope: root }
    );

    return (
        <svg
            ref={root}
            aria-hidden="true"
            className={className ? `tally-mark ${className}` : 'tally-mark'}
            viewBox="0 0 124 64"
        >
            <rect className="tally-mark__bar" height="56" width="8" x="14" y="4" />
            <rect className="tally-mark__bar" height="56" width="8" x="38" y="4" />
            <rect className="tally-mark__bar" height="56" width="8" x="62" y="4" />
            <rect className="tally-mark__bar" height="56" width="8" x="86" y="4" />
            <g transform="rotate(-20 62 32)">
                <rect className="tally-mark__slash" height="8" width="132" x="-4" y="28" />
            </g>
        </svg>
    );
};

export { TallyMark, type TallyMarkProps };
