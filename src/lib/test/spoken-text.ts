// The text of an element as assistive technology gets it: what is hidden from it left out
const spokenText = (element: Element | null | undefined): string | undefined => {
    if (!element) return undefined;
    const copy = element.cloneNode(true) as Element;
    copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
    return copy.textContent ?? undefined;
};

export { spokenText };
