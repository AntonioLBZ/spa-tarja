import { useDebouncedValue } from '@/lib/use-debounced-value';

interface SpokenHintProps {
    // The hint, or false while there is none
    children?: string | boolean;
}

// A quiet hint that changes with every key, such as what is left of an amount to split. It shows at once, and is read
// out once the typing pauses, from a status that stays in the page.
const SpokenHint = (props: SpokenHintProps) => {
    const { children } = props;
    const text = typeof children === 'string' ? children : '';
    const spoken = useDebouncedValue(text);

    return (
        <>
            {text && (
                <p className="field__hint" aria-hidden="true">
                    {text}
                </p>
            )}
            <div className="visually-hidden" role="status">
                {spoken}
            </div>
        </>
    );
};

export { SpokenHint, type SpokenHintProps };
