import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card, CardList } from './card';

describe('Card', () => {
    it('is a div unless told otherwise', () => {
        render(<Card>Rent</Card>);

        const card = screen.getByText('Rent');
        expect(card.tagName).toBe('DIV');
        expect(card.classList.contains('card')).toBe(true);
    });

    it('can be a list item', () => {
        render(
            <ul>
                <Card as="li">Rent</Card>
            </ul>
        );

        expect(screen.getByRole('listitem').textContent).toBe('Rent');
    });

    it('keeps what is inside it as it is', () => {
        render(
            <Card>
                <span>Spent</span>
                <strong>12</strong>
            </Card>
        );

        expect(screen.getByText('Spent').parentElement!.classList.contains('card')).toBe(true);
        expect(screen.getByText('12').parentElement!.classList.contains('card')).toBe(true);
    });

    it('keeps the class the call site needs for its layout', () => {
        render(<Card className="row row--left">Left</Card>);

        const card = screen.getByText('Left');
        expect(card.className).toBe('card row row--left');
    });
});

describe('CardList', () => {
    it('is an unordered list unless told otherwise', () => {
        render(
            <CardList>
                <Card as="li">Rent</Card>
                <Card as="li">Food</Card>
            </CardList>
        );

        const list = screen.getByRole('list');
        expect(list.tagName).toBe('UL');
        expect(list.classList.contains('card-list')).toBe(true);
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it.each(['ul', 'ol', 'dl'] as const)('can be a %s', (as) => {
        const { container } = render(
            <CardList as={as}>
                <Card as={as === 'dl' ? 'div' : 'li'}>Rent</Card>
            </CardList>
        );

        expect(container.firstElementChild!.tagName).toBe(as.toUpperCase());
    });

    it('holds the term and the value of a row straight inside its card', () => {
        const { container } = render(
            <CardList as="dl">
                <Card>
                    <dt>Spent</dt>
                    <dd>12</dd>
                </Card>
            </CardList>
        );

        const card = container.querySelector('.card')!;
        expect(card.parentElement!.tagName).toBe('DL');
        expect([...card.children].map((child) => child.tagName)).toEqual(['DT', 'DD']);
    });

    it('stacks its cards apart unless they are flush', () => {
        const { container } = render(<CardList>{null}</CardList>);

        expect(container.firstElementChild!.classList.contains('card-list--flush')).toBe(false);
    });

    it('can keep its cards flush', () => {
        const { container } = render(<CardList flush>{null}</CardList>);

        expect(container.firstElementChild!.classList.contains('card-list--flush')).toBe(true);
    });

    it('keeps the class the call site needs for its layout', () => {
        const { container } = render(<CardList className="day">{null}</CardList>);

        expect(container.firstElementChild!.className).toBe('card-list day');
    });

    it('can be named for assistive technology', () => {
        render(
            <CardList label="By category">
                <Card as="li">Rent</Card>
            </CardList>
        );

        expect(screen.getByRole('list', { name: 'By category' })).toBeDefined();
    });

    it('has no name unless given one', () => {
        render(
            <CardList>
                <Card as="li">Rent</Card>
            </CardList>
        );

        expect(screen.getByRole('list').getAttribute('aria-label')).toBeNull();
    });
});
