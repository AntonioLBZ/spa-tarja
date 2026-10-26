import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement them: the router scrolls on navigation, and Edit brings the add form into view
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

afterEach(cleanup);
