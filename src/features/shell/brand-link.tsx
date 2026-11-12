import { Link } from '@tanstack/react-router';

import { Brand } from '@/components/brand/brand';
import { isPrerelease } from '@/lib/prerelease';

// The logo leads home. It is never underlined.
const BrandLink = () => {
    return (
        <Link className="brand-link" to="/" activeOptions={{ exact: true }}>
            <Brand prerelease={isPrerelease()} />
        </Link>
    );
};

export { BrandLink };
