import { WIDE_QUERY } from '@/lib/use-wide';

interface Viewport {
    setWide: (wide: boolean) => void;
    listenerCount: () => number;
}

// jsdom has no matchMedia: this one answers the wide screen query and tells its listeners when the screen changes
const stubViewport = (wide: boolean): Viewport => {
    let isWide = wide;
    const listeners = new Set<() => void>();

    window.matchMedia = (media: string) => {
        return {
            get matches() {
                return media === WIDE_QUERY && isWide;
            },
            media,
            addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
            removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
        } as unknown as MediaQueryList;
    };

    return {
        setWide: (next) => {
            isWide = next;
            listeners.forEach((listener) => listener());
        },
        listenerCount: () => listeners.size,
    };
};

export { stubViewport, type Viewport };
