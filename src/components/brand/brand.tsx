import clsx from 'clsx';

import './brand.css';

// The name as a logo. It isn't translated.
function Brand(props: { size?: 'header' | 'hero' }) {
    const { size = 'header' } = props;
    return <span className={clsx('brand', `brand--${size}`)}>Tarja</span>;
}

export { Brand };
