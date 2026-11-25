interface PageScroll {
    scrollTo: (top: number) => void;
}

const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');

// jsdom neither lays out nor scrolls: this gives the page a height and a way to be moved, which tells its listeners
const stubPageScroll = (pageHeight: number): PageScroll => {
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: pageHeight });

    return {
        scrollTo: (top) => {
            Object.defineProperty(window, 'scrollY', { configurable: true, value: top });
            window.dispatchEvent(new Event('scroll'));
        },
    };
};

const releasePageScroll = () => {
    Reflect.deleteProperty(document.documentElement, 'scrollHeight');
    if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
};

export { releasePageScroll, stubPageScroll, type PageScroll };
