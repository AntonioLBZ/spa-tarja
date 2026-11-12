// How far from the edge of what can be seen the list stops, in px
const EDGE = 8;

interface ListPlacement {
    // Whether the list opens over the field instead of under it
    above: boolean;
    // The height, in px, the list may take on that side
    room: number;
}

// What a person can see around the field: the screen less the keyboard, cut down by every box that scrolls or clips
// what is inside it, like the sheet of a form
const visibleBand = (field: Element) => {
    const screen = window.visualViewport;
    let top = screen?.offsetTop ?? 0;
    let bottom = top + (screen?.height ?? window.innerHeight);

    for (let box = field.parentElement; box; box = box.parentElement) {
        if (getComputedStyle(box).overflowY === 'visible') continue;
        const rect = box.getBoundingClientRect();
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
    }

    return { top, bottom };
};

// Under the field when the list fits there, else on the side with more room, which is also all it may take
const placeList = (field: Element, wanted: number): ListPlacement => {
    const band = visibleBand(field);
    const rect = field.getBoundingClientRect();
    const below = Math.max(0, band.bottom - rect.bottom - EDGE);
    const above = Math.max(0, rect.top - band.top - EDGE);

    return below >= wanted || below >= above ? { above: false, room: below } : { above: true, room: above };
};

export { placeList, type ListPlacement };
