import type { ReactNode } from 'react';

import './list-section.css';

interface ListSectionProps {
    title: string;
    // The action of the section, at the end of the row of its heading and never a row of its list (ADR-0038)
    action?: ReactNode;
    children: ReactNode;
}

// A list of the Groups screen with its own heading; the section has no name, so it is no landmark
const ListSection = (props: ListSectionProps) => {
    const { title, action, children } = props;

    return (
        <section className="list-section">
            <div className="list-section__head">
                <h2>{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
};

export { ListSection, type ListSectionProps };
