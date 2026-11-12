import clsx from 'clsx';
import { useRef, type ReactNode } from 'react';

import { MOTION_QUERY, canAnimate, gsap, useGSAP } from '@/lib/motion/gsap';
import { backTarget } from '@/lib/route-transition';
import { useWide } from '@/lib/use-wide';

import { BackLink } from './back-link';
import { BrandLink } from './brand-link';
import { useShownPathname } from './shown-path';

import './page.css';

interface PageProps {
    // The h1 of the screen
    title: string;
    // False when the hero says it better than the heading does; the heading then stays for assistive technology
    titleVisible?: boolean;
    // What stands under the title in the colored field
    hero?: ReactNode;
    // The short text that takes the place of the hero in the bar once the sheet has covered it
    compact?: ReactNode;
    className?: string;
    // The sheet: everything else on the screen
    children: ReactNode;
}

// A screen is a ticket: a colored field with the answer, a perforated edge and the sheet that holds the details. The
// sheet slides over the field as the page scrolls, and the bar keeps a short title in its place.
const Page = (props: PageProps) => {
    const { title, titleVisible = true, hero, compact, className, children } = props;
    const root = useRef<HTMLDivElement>(null);
    const wide = useWide();
    const deep = backTarget(useShownPathname()) !== undefined;

    useGSAP(
        () => {
            const page = root.current;
            const stuck = page?.querySelector<HTMLElement>('.page__field');
            const field = page?.querySelector<HTMLElement>('.page__field-inner');
            const sheet = page?.querySelector<HTMLElement>('.page__sheet');
            if (!page || !stuck || !field || !sheet || !canAnimate()) return;

            const mm = gsap.matchMedia();
            mm.add(MOTION_QUERY, () => {
                // Where the field sticks: right under the bar, or the header of the wide layout
                const barBottom = () => Number.parseFloat(getComputedStyle(stuck).top) || 0;
                // How far the page has to scroll before the sheet reaches the bar, measured from where it rests
                const reach = () => sheet.getBoundingClientRect().top + window.scrollY - barBottom();
                gsap.to(field, {
                    opacity: 0,
                    y: -28,
                    scale: 0.96,
                    transformOrigin: '50% 0%',
                    ease: 'none',
                    scrollTrigger: { start: 0, end: () => Math.max(reach() - 24, 1), scrub: true },
                });
                // Rows may arrive after the page is up, so the title follows the scroll itself, not a range fixed at the start
                const mark = () => {
                    page.dataset.collapsed = String(window.scrollY >= Math.max(reach() - 4, 1));
                };
                window.addEventListener('scroll', mark, { passive: true });
                mark();
                return () => window.removeEventListener('scroll', mark);
            });
            return () => mm.revert();
        },
        { scope: root }
    );

    const pageClsx = clsx('page', className);
    const titleClsx = clsx('page__title', { 'visually-hidden': !titleVisible });

    return (
        <div ref={root} className={pageClsx} data-collapsed="false">
            {!wide && (
                <header className="page__bar" role="banner">
                    <div className="page__bar-start">{deep ? <BackLink /> : <BrandLink />}</div>
                    <p className="page__compact" aria-hidden="true">
                        {compact ?? title}
                    </p>
                    {deep && (
                        <div className="page__bar-end">
                            <BrandLink />
                        </div>
                    )}
                </header>
            )}
            <div className="page__field">
                <div className="page__field-inner">
                    <h1 className={titleClsx} data-enter="title">
                        {title}
                    </h1>
                    {hero}
                </div>
            </div>
            <div className="page__sheet perforated">{children}</div>
        </div>
    );
};

export { Page, type PageProps };
