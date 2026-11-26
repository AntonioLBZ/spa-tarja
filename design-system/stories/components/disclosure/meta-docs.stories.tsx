import { Disclosure } from '@/components/disclosure/disclosure';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Disclosure/Examples',
    component: Disclosure,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return (
        <Disclosure summary="Show the numbers" chevron>
            The numbers of the chart, in a table.
        </Disclosure>
    );
};

export const Open = () => {
    return (
        <Disclosure summary="Closed groups" chevron defaultOpen>
            Lisbon trip
        </Disclosure>
    );
};

export const AlignTop = () => {
    return (
        <Disclosure summary="Lunch with Marta at the place by the river, on the way back" chevron align="top">
            Edit, Duplicate, Delete
        </Disclosure>
    );
};

export const WideChevron = () => {
    return (
        <Disclosure summary="Ana gets back €21.50" chevron wideChevron>
            You owe Ana €21.50
        </Disclosure>
    );
};

export const InForm = () => {
    return (
        <Disclosure summary="More options" hint="Today · Paid now · In one payment" inForm chevron>
            The day, the payment and the installments.
        </Disclosure>
    );
};

export const OneLine = () => {
    return (
        <Disclosure summary="Split" hint="Paid by you" inForm oneLine chevron>
            With, Paid by and Who&apos;s in.
        </Disclosure>
    );
};

export const Heading = () => {
    return (
        <Disclosure summary="Settled" heading="h3" chevron>
            Ana and you
        </Disclosure>
    );
};

export const Disabled = () => {
    return (
        <Disclosure summary="Filters" chevron disabled>
            The filters.
        </Disclosure>
    );
};

export default Story;
