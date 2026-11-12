import { afterEach, describe, expect, it } from 'vitest';

const page = () => {
    document.body.innerHTML = `
        <button id="opener">Opener</button>
        <button id="behind">Behind</button>
        <dialog id="modal" tabindex="-1"><button id="inside">Inside</button></dialog>
    `;
    return {
        opener: document.getElementById('opener') as HTMLButtonElement,
        behind: document.getElementById('behind') as HTMLButtonElement,
        modal: document.getElementById('modal') as HTMLDialogElement,
        inside: document.getElementById('inside') as HTMLButtonElement,
    };
};

afterEach(() => {
    document.body.innerHTML = '';
});

describe('the modal dialog of the tests', () => {
    it('takes the focus when it opens, and nothing behind it can', () => {
        const { opener, behind, modal } = page();
        opener.focus();

        modal.showModal();
        behind.focus();

        expect(document.activeElement).toBe(modal);
    });

    it('takes the focus inside it', () => {
        const { modal, inside } = page();
        modal.showModal();

        inside.focus();

        expect(document.activeElement).toBe(inside);
    });

    it('answers nothing behind it', () => {
        const { behind, modal } = page();
        let pressed = 0;
        behind.addEventListener('click', () => pressed++);
        modal.showModal();

        behind.click();

        expect(pressed).toBe(0);
    });

    it('hands the focus back to what had it, and the page answers again', () => {
        const { opener, behind, modal } = page();
        let pressed = 0;
        behind.addEventListener('click', () => pressed++);
        opener.focus();
        modal.showModal();

        modal.close();
        behind.click();

        expect(document.activeElement).toBe(opener);
        expect(pressed).toBe(1);
    });

    it('lets the page take the focus once it is closed', () => {
        const { behind, modal } = page();
        modal.showModal();
        modal.close();

        behind.focus();

        expect(document.activeElement).toBe(behind);
    });

    it('lets go of a dialog that left the page while it was open', () => {
        const { behind, modal } = page();
        modal.showModal();
        modal.remove();

        behind.focus();

        expect(document.activeElement).toBe(behind);
    });
});
