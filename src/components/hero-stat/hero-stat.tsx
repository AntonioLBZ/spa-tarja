import clsx from 'clsx';
import { useRef, type ReactNode } from 'react';

import { CountUp } from '@/components/count-up/count-up';
import { MOTION_QUERY, canAnimate, gsap, useGSAP } from '@/lib/motion/gsap';

import './hero-stat.css';

interface HeroStatProps {
    // What the number is, a short line over it
    label?: ReactNode;
    // The number: an amount that counts up to its value, or any text for a stat that isn't one
    amount?: { value: number; format: (value: number) => string };
    text?: ReactNode;
    // How big the number is: the biggest thing of the screen, or a sentence at the size of a title
    size?: 'hero' | 'title';
    // One line under it: what to make of it
    sub?: ReactNode;
    // A line that changes while the person looks at it is announced
    subLive?: boolean;
    // What stands under the lines, such as the comb of the month
    children?: ReactNode;
}

// What the field of a screen says: a label, the one big number and a line about it. Its lines rise in one after the
// other when the screen comes in.
const HeroStat = (props: HeroStatProps) => {
    const { label, amount, text, size = 'hero', sub, subLive, children } = props;
    const root = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            const lines = root.current?.querySelectorAll('[data-enter]');
            if (!lines?.length || !canAnimate()) return;
            const mm = gsap.matchMedia();
            mm.add(MOTION_QUERY, () => {
                gsap.from(lines, {
                    y: 22,
                    opacity: 0,
                    duration: 0.8,
                    ease: 'expo.out',
                    stagger: 0.09,
                    clearProps: 'transform,opacity',
                });
            });
            return () => mm.revert();
        },
        { scope: root }
    );

    return (
        <div ref={root} className="hero-stat">
            {label && (
                <p className="hero-stat__label" data-enter>
                    {label}
                </p>
            )}
            {(amount || text) && (
                <p className={clsx('hero-stat__amount', { 'hero-stat__amount--title': size === 'title' })} data-enter>
                    {amount ? <CountUp value={amount.value} format={amount.format} /> : text}
                </p>
            )}
            {(sub || subLive) && (
                <p className="hero-stat__sub" data-enter role={subLive ? 'status' : undefined}>
                    {sub}
                </p>
            )}
            {children && <div data-enter>{children}</div>}
        </div>
    );
};

export { HeroStat, type HeroStatProps };
