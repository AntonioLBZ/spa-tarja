import clsx from 'clsx';
import { useRef, type CSSProperties, type PointerEvent } from 'react';

import { DURATION, MOTION_QUERY, canAnimate, gsap, useGSAP } from '@/lib/motion/gsap';

import './month-comb.css';

interface MonthCombProps {
    // What was spent on each day of the month, the first day first
    days: readonly number[];
    // The day of the month it is today; 0 for a month that isn't this one, which then shows every day as past
    today: number;
    // The weekday of the first day, 0 for Sunday: the ticks are grouped by calendar week
    firstWeekday: number;
    // The day under the finger or the pointer, or null once it leaves
    onScrub: (day: number | null) => void;
    // A tap on a day
    onPick: (day: number) => void;
}

// The month as a comb: one tick per day, as tall as what was spent that day, a longer gap between weeks, today in the
// spark color and the days to come as dots. A finger or a pointer moving along it reads the days off; a tap picks one.
const MonthComb = (props: MonthCombProps) => {
    const { days, today, firstWeekday, onScrub, onPick } = props;
    const root = useRef<HTMLDivElement>(null);
    const active = useRef<number | null>(null);
    const moved = useRef(false);
    const biggest = Math.max(...days, 1);

    useGSAP(
        () => {
            const ticks = root.current?.querySelectorAll<HTMLElement>('.month-comb__tick');
            if (!ticks?.length || !canAnimate()) return;
            const mm = gsap.matchMedia();
            mm.add(MOTION_QUERY, () => {
                gsap.from(ticks, {
                    scaleY: 0,
                    transformOrigin: '50% 100%',
                    duration: DURATION.slow * 1.8,
                    ease: 'back.out(2.2)',
                    stagger: { each: 0.016 },
                    delay: 0.2,
                    clearProps: 'transform',
                });
            });
            return () => mm.revert();
        },
        { scope: root, dependencies: [days.length] }
    );

    // The tick whose middle is nearest the pointer: the ticks have a width of their own and gaps between weeks, so the
    // position along the box is not the day
    const dayAt = (event: PointerEvent<HTMLDivElement>) => {
        const ticks = root.current?.querySelectorAll<HTMLElement>('.month-comb__tick') ?? [];
        let nearest = 0;
        let reach = Infinity;
        ticks.forEach((tick, index) => {
            const box = tick.getBoundingClientRect();
            const gap = Math.abs(event.clientX - (box.left + box.width / 2));
            if (gap < reach) {
                reach = gap;
                nearest = index;
            }
        });
        return nearest + 1;
    };

    const lift = (day: number | null) => {
        if (active.current === day) return;
        const ticks = root.current?.querySelectorAll<HTMLElement>('.month-comb__tick');
        if (active.current !== null) ticks?.[active.current - 1]?.removeAttribute('data-active');
        if (day !== null) ticks?.[day - 1]?.setAttribute('data-active', '');
        active.current = day;
        onScrub(day);
    };

    const ticks = days.map((cents, index) => {
        const day = index + 1;
        const weekday = (firstWeekday + index) % 7;
        const future = today > 0 && day > today;
        const tickClsx = clsx('month-comb__tick', {
            'month-comb__tick--today': day === today,
            'month-comb__tick--future': future,
            'month-comb__tick--empty': !future && cents === 0,
            'month-comb__tick--week': weekday === 1 && day > 1,
        });
        const style = { '--rise': future || cents === 0 ? 0 : Math.max(0.14, cents / biggest) } as CSSProperties;

        return <span key={day} className={tickClsx} style={style} />;
    });

    return (
        <div
            ref={root}
            className="month-comb"
            aria-hidden="true"
            onPointerDown={(event) => {
                moved.current = false;
                lift(dayAt(event));
            }}
            onPointerMove={(event) => {
                if (event.pointerType === 'mouse' || event.buttons > 0) {
                    moved.current = true;
                    lift(dayAt(event));
                }
            }}
            onPointerUp={(event) => {
                if (!moved.current || event.pointerType !== 'mouse') onPick(dayAt(event));
                if (event.pointerType !== 'mouse') lift(null);
            }}
            onPointerLeave={() => lift(null)}
            onPointerCancel={() => lift(null)}
        >
            <div className="month-comb__ticks">{ticks}</div>
            <div className="month-comb__axis">
                <span>1</span>
                <span>{Math.ceil(days.length / 2)}</span>
                <span>{days.length}</span>
            </div>
        </div>
    );
};

export { MonthComb, type MonthCombProps };
