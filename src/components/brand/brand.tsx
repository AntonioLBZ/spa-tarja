import clsx from 'clsx';

import './brand.css';

interface BrandProps {
    /** `header` in the header, `hero` over the sign-in screen */
    size?: 'header' | 'hero';
    /** Adds `-pre`, on the prerelease Worker */
    prerelease?: boolean;
}

const Brand = (props: BrandProps) => {
    const { size = 'header', prerelease = false } = props;
    const brandClsx = clsx('brand', `brand--${size}`);

    return (
        <span className={brandClsx}>
            Tarja
            {prerelease && <span className="brand__suffix">-pre</span>}
        </span>
    );
};

export { Brand, type BrandProps };
