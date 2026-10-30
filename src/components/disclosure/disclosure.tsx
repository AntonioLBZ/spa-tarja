import clsx from 'clsx';
import { useId, useState, type ReactNode, type Ref } from 'react';

import { Icon } from '@/components/icon/icon';

import './disclosure.css';

interface DisclosureProps {
    as?: 'li' | 'div' | 'section';
    // Puts the toggle in a heading of that level, for a disclosure that titles a section
    heading?: 'h2' | 'h3';
    // What the toggle shows
    summary: ReactNode;
    // Controlled when given; otherwise the disclosure keeps its own state, starting from `defaultOpen`
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    disabled?: boolean;
    // Keeps the panel in the page, hidden, while it is closed, so what was typed in it survives
    keepMounted?: boolean;
    // A chevron at the end of the toggle, a half turn when open
    chevron?: boolean;
    toggleRef?: Ref<HTMLButtonElement>;
    className?: string;
    children: ReactNode;
}

interface DisclosurePanelProps {
    id?: string;
    hidden?: boolean;
    className?: string;
    children: ReactNode;
}

// The box under a row that comes in with a fade and a short shift. Alone, for what looks like an open disclosure
// without being one.
const DisclosurePanel = (props: DisclosurePanelProps) => {
    const { id, hidden, className, children } = props;
    const panelClsx = clsx('disclosure__panel', className);

    return (
        <div className={panelClsx} hidden={hidden} id={id}>
            {children}
        </div>
    );
};

// A toggle button and, under it, the panel it opens
const Disclosure = (props: DisclosureProps) => {
    const {
        as: Tag = 'div',
        heading: Heading,
        summary,
        open,
        defaultOpen = false,
        onOpenChange,
        disabled,
        keepMounted,
        chevron,
        toggleRef,
        className,
        children,
    } = props;
    const panelId = useId();
    const [ownOpen, setOwnOpen] = useState(defaultOpen);
    const isOpen = open ?? ownOpen;

    const handleToggle = () => {
        const next = !isOpen;
        if (open === undefined) setOwnOpen(next);
        onOpenChange?.(next);
    };

    const panelInPage = isOpen || keepMounted;
    const toggle = (
        <button
            ref={toggleRef}
            className="disclosure__toggle"
            aria-controls={panelInPage ? panelId : undefined}
            aria-expanded={isOpen}
            disabled={disabled}
            type="button"
            onClick={handleToggle}
        >
            {summary}
            {chevron && (
                <span className="disclosure__chevron">
                    <Icon name="expand_more" />
                </span>
            )}
        </button>
    );
    const disclosureClsx = clsx('disclosure', className);

    return (
        <Tag className={disclosureClsx}>
            {Heading ? <Heading className="disclosure__heading">{toggle}</Heading> : toggle}
            {panelInPage && (
                <DisclosurePanel id={panelId} hidden={!isOpen}>
                    {children}
                </DisclosurePanel>
            )}
        </Tag>
    );
};

export { Disclosure, DisclosurePanel, type DisclosurePanelProps, type DisclosureProps };
