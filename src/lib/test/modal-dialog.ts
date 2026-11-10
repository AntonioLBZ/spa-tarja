// jsdom has no modal <dialog>. This one behaves as a browser holds it: the page behind is inert (nothing outside takes
// the focus and no event reaches it), and closing hands the focus back to what had it when it opened.
const modals: HTMLDialogElement[] = [];
const openers = new WeakMap<HTMLDialogElement, HTMLElement | null>();

const topModal = () => {
    for (let index = modals.length - 1; index >= 0; index--) {
        const dialog = modals[index]!;
        if (dialog.isConnected && dialog.open) return dialog;
    }
    return undefined;
};

const isInert = (node: Node) => {
    const top = topModal();
    return top !== undefined && !top.contains(node);
};

const INERT_EVENTS = [
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'pointerdown',
    'pointerup',
    'keydown',
    'keyup',
    'input',
    'change',
];

const installModalDialog = () => {
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function inertAwareFocus(this: HTMLElement, options?: FocusOptions) {
        if (isInert(this)) return;
        focus.call(this, options);
    };

    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
        if (this.open) return;
        const active = document.activeElement;
        openers.set(this, active instanceof HTMLElement && active !== document.body ? active : null);
        this.setAttribute('open', '');
        modals.push(this);
        if (active instanceof HTMLElement) active.blur();
        this.focus();
    };

    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
        if (!this.open) return;
        const active = document.activeElement;
        if (active instanceof HTMLElement && this.contains(active)) active.blur();
        this.removeAttribute('open');
        const opener = openers.get(this);
        openers.delete(this);
        if (opener?.isConnected) opener.focus();
        this.dispatchEvent(new Event('close'));
    };

    for (const type of INERT_EVENTS) {
        document.addEventListener(
            type,
            (event) => {
                if (event.target instanceof Node && event.target !== document && isInert(event.target)) {
                    event.stopImmediatePropagation();
                }
            },
            true
        );
    }
};

const releaseModals = () => {
    modals.length = 0;
};

export { installModalDialog, releaseModals };
