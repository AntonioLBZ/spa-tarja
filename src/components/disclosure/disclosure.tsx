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
    // What the panel holds, said in the toggle after the summary while it is closed
    hint?: ReactNode;
    // Keeps the summary and the hint on one line, the hint cut with an ellipsis, instead of putting it under
    oneLine?: boolean;
    // The id of what says, elsewhere on the page, what the panel holds
    describedBy?: string;
    // Controlled when given; otherwise the disclosure keeps its own state, starting from `defaultOpen`
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    disabled?: boolean;
    // Keeps the panel in the page, hidden, while it is closed, so what was typed in it survives
    keepMounted?: boolean;
    // A chevron at the end of the toggle, a half turn when open
    chevron?: boolean;
    // Where the toggle lines up what it holds and the chevron: in the middle, or on the first line of a tall row
    align?: 'center' | 'top';
    // The chevron in the middle of a column as wide as a touch target, with no gap before it
    wideChevron?: boolean;
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

// The box under a row that comes in with a fade and a short shift
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
        hint,
        oneLine,
        describedBy,
        open,
        defaultOpen = false,
        onOpenChange,
        disabled,
        keepMounted,
        chevron,
        align = 'center',
        wideChevron,
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
            aria-describedby={describedBy}
            aria-expanded={isOpen}
            disabled={disabled}
            type="button"
            onClick={handleToggle}
        >
            {hint && !isOpen ? (
                <span className="disclosure__summary">
                    <span>{summary}</span>
                    <span className="disclosure__hint">{hint}</span>
                </span>
            ) : (
                summary
            )}
            {chevron && (
                <span className="disclosure__chevron">
                    <Icon name="expand_more" />
                </span>
            )}
        </button>
    );
    const disclosureClsx = clsx(
        'disclosure',
        {
            'disclosure--top': align === 'top',
            'disclosure--wide-chevron': wideChevron,
            'disclosure--one-line': oneLine,
        },
        className
    );

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

export { Disclosure, type DisclosureProps };
