import clsx from 'clsx';
import {
    createContext,
    use,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type PointerEvent,
    type ReactNode,
} from 'react';

import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';
import { readDuration } from '@/lib/motion';

import './banner.css';

// How long a banner stays, not counting the time the pointer or the focus holds it
const SHOW_FOR_MS = 8_000;

// A move shorter than this is a tap, not a swipe
const SWIPE_SLOP_PX = 8;

interface BannerOptions {
    title: string;
    message: string;
    // Opens what the banner is about
    onOpen: () => void;
    // Called once when it goes, however it goes, but not when a new text takes its place
    onGone?: () => void;
}

interface BannerApi {
    // Shows the banner, or puts this text in the one showing and starts its count again
    show: (options: BannerOptions) => void;
    dismiss: () => void;
}

interface ShownBanner extends BannerOptions {
    id: number;
    // Counts the times it was shown again, which starts its count again
    round: number;
    // Leaving to that side after a swipe, or up when it goes otherwise
    leaving: 'up' | 'left' | 'right' | null;
}

interface BannerBoxProps {
    banner: ShownBanner;
    dismissLabel: string;
    onDismiss: (to?: 'left' | 'right') => void;
}

interface BannerProviderProps {
    // Names the button that clears the banner away
    dismissLabel: string;
    children: ReactNode;
}

const BannerContext = createContext<BannerApi | null>(null);

// The banner: one button that opens what it is about and one that clears it away. It goes by itself after 8 s, held while
// the pointer is over it or the focus inside, and a swipe to the side of more than a third of its width clears it.
const BannerBox = (props: BannerBoxProps) => {
    const { banner, dismissLabel, onDismiss } = props;
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [shift, setShift] = useState<number | null>(null);
    const remaining = useRef(SHOW_FOR_MS);
    const start = useRef<number | null>(null);
    const swiped = useRef(false);
    const counting = !hovered && !focused && shift === null && banner.leaving === null;
    const bannerClsx = clsx('banner', {
        'banner--dragged': shift !== null,
        [`banner--leaving-${banner.leaving}`]: banner.leaving !== null,
    });
    const style = shift === null ? undefined : ({ '--banner-shift': `${shift}px` } as CSSProperties);

    useEffect(() => {
        remaining.current = SHOW_FOR_MS;
    }, [banner.round]);

    useEffect(() => {
        if (!counting) return;
        const startedAt = Date.now();
        const timer = setTimeout(() => onDismiss(), remaining.current);
        return () => {
            clearTimeout(timer);
            remaining.current -= Date.now() - startedAt;
        };
    }, [counting, onDismiss, banner.round]);

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        start.current = event.clientX;
        swiped.current = false;
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (start.current === null) return;
        const dx = event.clientX - start.current;
        if (Math.abs(dx) < SWIPE_SLOP_PX && !swiped.current) return;
        swiped.current = true;
        setShift(dx);
    };

    const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
        if (start.current === null) return;
        const dx = event.clientX - start.current;
        start.current = null;
        setShift(null);
        if (!swiped.current) return;
        const width = event.currentTarget.getBoundingClientRect().width;
        if (Math.abs(dx) > width / 3) onDismiss(dx < 0 ? 'left' : 'right');
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        onDismiss();
    };

    return (
        <div
            className={bannerClsx}
            style={style}
            onBlur={() => setFocused(false)}
            onFocus={() => setFocused(true)}
            onKeyDown={onKeyDown}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onPointerCancel={onPointerEnd}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
        >
            <button
                className="banner__open"
                disabled={banner.leaving !== null}
                type="button"
                onClick={() => {
                    if (swiped.current) return;
                    banner.onOpen();
                    onDismiss();
                }}
            >
                <span className="banner__title">{banner.title}</span>
                <span className="banner__message">{banner.message}</span>
            </button>
            <Button
                ghost
                glyph
                className="banner__dismiss"
                disabled={banner.leaving !== null}
                aria-label={dismissLabel}
                onClick={() => onDismiss()}
            >
                <Icon name="close" />
            </Button>
        </div>
    );
};

// One banner at a time, above the routes so it survives a change of screen. Its `role="status"` region is always in the
// page, so a banner that comes in is announced; it never takes the focus.
const BannerProvider = (props: BannerProviderProps) => {
    const { dismissLabel, children } = props;
    const [banner, setBanner] = useState<ShownBanner | null>(null);
    const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const lastId = useRef(0);
    // What to call when the banner showing goes, null once it has been called
    const onGone = useRef<(() => void) | null>(null);

    useEffect(() => () => clearTimeout(leaveTimer.current), []);

    const show = useCallback((options: BannerOptions) => {
        clearTimeout(leaveTimer.current);
        onGone.current = options.onGone ?? (() => undefined);
        setBanner((current) =>
            current && current.leaving === null
                ? { ...current, ...options, round: current.round + 1 }
                : { ...options, id: ++lastId.current, round: 0, leaving: null }
        );
    }, []);

    const dismiss = useCallback((to?: 'left' | 'right') => {
        clearTimeout(leaveTimer.current);
        const gone = onGone.current;
        onGone.current = null;
        gone?.();
        const duration = readDuration('--duration-base');
        if (duration === 0) {
            setBanner(null);
            return;
        }
        setBanner((current) => current && { ...current, leaving: to ?? 'up' });
        leaveTimer.current = setTimeout(() => setBanner(null), duration);
    }, []);

    const api = useMemo(() => ({ show, dismiss: () => dismiss() }), [show, dismiss]);

    return (
        <BannerContext value={api}>
            {children}
            <div className="banner-region" role="status">
                {banner && (
                    <BannerBox key={banner.id} banner={banner} dismissLabel={dismissLabel} onDismiss={dismiss} />
                )}
            </div>
        </BannerContext>
    );
};

const useBanner = (): BannerApi => {
    const value = use(BannerContext);
    if (value === null) throw new Error('useBanner needs a BannerProvider');
    return value;
};

export { BannerProvider, useBanner, type BannerApi, type BannerOptions, type BannerProviderProps };
