import { Icon } from '@/components/icon/icon';

import './person-line.css';

interface PersonLineProps {
    // Somebody who uses the app, or a dummy, a name only
    user: boolean;
    name: string;
    // Who they are and what they owe, in words, each a part of the line under the name
    details?: readonly string[];
}

// A person in the lists of people: who they are at a glance, a user filled and a dummy in outline, then the name and,
// under it, the rest
const PersonLine = (props: PersonLineProps) => {
    const { user, name, details = [] } = props;

    return (
        <span className="person-line">
            <Icon name={user ? 'person_filled' : 'person'} />
            <span className="person-line__body">
                <span className="person-line__name">{name}</span>
                {details.length > 0 && (
                    <span className="person-line__detail">
                        {details.map((detail) => (
                            <span key={detail}>{detail}</span>
                        ))}
                    </span>
                )}
            </span>
        </span>
    );
};

export { PersonLine, type PersonLineProps };
