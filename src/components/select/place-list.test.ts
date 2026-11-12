import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { placeList } from './place-list';

const EDGE = 8;

const rectOf = (top: number, bottom: number) => {
    return {
        top,
        bottom,
        height: bottom - top,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: top,
        toJSON: () => ({}),
    } as DOMRect;
};

const rects = new Map<Element, DOMRect>();

const place = (element: Element, top: number, bottom: number) => {
    rects.set(element, rectOf(top, bottom));
};

const field = (parent: Element = document.body) => {
    const element = document.createElement('div');
    parent.appendChild(element);
    return element;
};

const box = (overflowY: string, parent: Element = document.body) => {
    const element = document.createElement('div');
    element.style.overflowY = overflowY;
    parent.appendChild(element);
    return element;
};

beforeEach(() => {
    vi.stubGlobal('innerHeight', 800);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        return rects.get(this) ?? rectOf(0, 0);
    });
});

afterEach(() => {
    rects.clear();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('placeList', () => {
    it('keeps the list under the field when it fits there, with the room that is left', () => {
        const input = field();
        place(input, 100, 144);

        expect(placeList(input, 300)).toEqual({ above: false, room: 800 - 144 - EDGE });
    });

    it('opens the list above the field when it does not fit under it and there is more room above', () => {
        const input = field();
        place(input, 600, 644);

        expect(placeList(input, 300)).toEqual({ above: true, room: 600 - EDGE });
    });

    it('keeps the list under the field when neither side is enough and under has more, and gives it what is there', () => {
        const input = field();
        place(input, 150, 194);
        vi.stubGlobal('innerHeight', 400);

        expect(placeList(input, 300)).toEqual({ above: false, room: 400 - 194 - EDGE });
    });

    it('goes above only when above has more room than under, never just because under is short', () => {
        const input = field();
        place(input, 10, 54);
        vi.stubGlobal('innerHeight', 100);

        expect(placeList(input, 300)).toEqual({ above: false, room: 100 - 54 - EDGE });
    });

    it('measures against the box that scrolls around the field, not only against the screen', () => {
        const sheet = box('auto');
        const input = field(sheet);
        place(sheet, 32, 332);
        place(input, 250, 294);

        expect(placeList(input, 200)).toEqual({ above: true, room: 250 - 32 - EDGE });
    });

    it('also measures against a box that clips without scrolling', () => {
        const clip = box('hidden');
        const input = field(clip);
        place(clip, 0, 300);
        place(input, 250, 294);

        expect(placeList(input, 200).above).toBe(true);
    });

    it('takes the narrowest of the boxes that cut the view down', () => {
        const outer = box('auto');
        const inner = box('auto', outer);
        const input = field(inner);
        place(outer, 0, 500);
        place(inner, 100, 400);
        place(input, 150, 194);

        expect(placeList(input, 500)).toEqual({ above: false, room: 400 - 194 - EDGE });
    });

    it('ignores a box that neither scrolls nor clips, however small it is', () => {
        const plain = box('visible');
        const input = field(plain);
        place(plain, 100, 120);
        place(input, 100, 144);

        expect(placeList(input, 300)).toEqual({ above: false, room: 800 - 144 - EDGE });
    });

    it('measures against what the keyboard leaves of the screen when the browser says so', () => {
        const input = field();
        place(input, 200, 244);
        vi.stubGlobal('visualViewport', { offsetTop: 0, height: 400 });

        expect(placeList(input, 100)).toEqual({ above: false, room: 400 - 244 - EDGE });
    });

    it('counts from the top of the visible screen when it has been scrolled', () => {
        const input = field();
        place(input, 520, 564);
        vi.stubGlobal('visualViewport', { offsetTop: 100, height: 500 });

        expect(placeList(input, 300)).toEqual({ above: true, room: 520 - 100 - EDGE });
    });

    it('never gives a negative room, when the field fills what can be seen', () => {
        const input = field();
        place(input, 0, 40);
        vi.stubGlobal('innerHeight', 40);

        expect(placeList(input, 300).room).toBe(0);
    });
});
