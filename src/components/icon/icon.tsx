import './icon.css';

import { ICON_PATHS, type IconName } from './icon-paths';

// Decoration, never the only way to tell what something is: the name always comes with it
function Icon(props: { name: IconName }) {
    const { name } = props;

    return (
        <svg
            aria-hidden="true"
            className="icon"
            data-icon={name}
            fill="currentColor"
            focusable="false"
            viewBox="0 -960 960 960"
        >
            <path d={ICON_PATHS[name]} />
        </svg>
    );
}

export { Icon };
