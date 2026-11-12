import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP);
// ScrollTrigger asks the browser for its media as it registers, which a test environment can't answer
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') gsap.registerPlugin(ScrollTrigger);

// GSAP eases and durations (seconds) matching the CSS tokens of the same name
const EASE = {
    standard: 'power3.out',
    enter: 'expo.out',
    exit: 'power2.in',
    spring: 'back.out(1.7)',
} as const;

const DURATION = { fast: 0.14, base: 0.26, slow: 0.44 } as const;

// Everything that moves lives inside this query; outside it the final state is set at once
const MOTION_QUERY = '(prefers-reduced-motion: no-preference)';

// Tests and the first paint have no matchMedia: there the final state is the only state
const canAnimate = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

export { DURATION, EASE, MOTION_QUERY, ScrollTrigger, canAnimate, gsap, useGSAP };
