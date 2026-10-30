import clsx from 'clsx';

import './brand.css';

interface BrandProps {
    size?: 'header' | 'hero';
}

const Brand = (props: BrandProps) => {
    const { size = 'header' } = props;
    const brandClsx = clsx('brand', `brand--${size}`);

    return <span className={brandClsx}>Tarja</span>;
};

export { Brand, type BrandProps };
