import clsx from 'clsx';
import {
    createContext,
    use,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactNode,
} from 'react';

import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';
import { readDuration, useSwipeAway, type SwipeSide } from '@/lib/motion';

import './banner.css';

// How long a banner stays, not counting the time the pointer or the focus holds it
const SHOW_FOR_MS = 8_000;

// Back toward the edge it came from, or to a side (ADR-0037)
const SWIPED_TO: readonly SwipeSide[] = ['left', 'right', 'up'];

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
    // Fading out, about to go
    leaving: boolean;
}

interface BannerBoxProps {
    banner: ShownBanner;
    dismissLabel: string;
    onDismiss: (swiped?: boolean) => void;
}

interface BannerProviderProps {
    // Names the button that clears the banner away
    dismissLabel: string;
    children: ReactNode;
}

const BannerContext = createContext<BannerApi | null>(null);

// The banner: one button that opens what it is about and one that clears it away. It goes by itself after 8 s, held while
// the pointer is over it or the focus inside, or while it is dragged, and a swipe to a side or up clears it.
const BannerBox = (props: BannerBoxProps) => {
    const { banner, dismissLabel, onDismiss } = props;
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const remaining = useRef(SHOW_FOR_MS);
    const swipe = useSwipeAway({ sides: SWIPED_TO, onAway: () => onDismiss(true), on: !banner.leaving });
    const counting = !hovered && !focused && !swipe.dragged && !banner.leaving;
    const bannerClsx = clsx('banner', {
        'banner--dragged': swipe.dragged,
        'banner--leaving': banner.leaving,
    });

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

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        onDismiss();
    };

    return (
        <div
            className={bannerClsx}
            style={swipe.style}
            onBlur={() => setFocused(false)}
            onFocus={() => setFocused(true)}
            onKeyDown={onKeyDown}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            {...swipe.handlers}
        >
            <button
                className="banner__open"
                disabled={banner.leaving}
                type="button"
                onClick={() => {
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
                disabled={banner.leaving}
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
            current && !current.leaving
                ? { ...current, ...options, round: current.round + 1 }
                : { ...options, id: ++lastId.current, round: 0, leaving: false }
        );
    }, []);

    const dismiss = useCallback((swiped?: boolean) => {
        clearTimeout(leaveTimer.current);
        const gone = onGone.current;
        onGone.current = null;
        gone?.();
        const duration = readDuration('--duration-base');
        // Swiped away, the finger already took it out: it goes where it was let go
        if (duration === 0 || swiped) {
            setBanner(null);
            return;
        }
        setBanner((current) => current && { ...current, leaving: true });
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
