import { Button } from '@/components/button/button';

import './update-prompt.css';

interface UpdatePromptProps {
    message: string;
    labels: { apply: string; dismiss: string };
    onApply: () => void;
    onDismiss: () => void;
}

// A bar fixed to the bottom edge that says a new version is ready, to apply now or leave for later
const UpdatePrompt = (props: UpdatePromptProps) => {
    const { message, labels, onApply, onDismiss } = props;

    return (
        <div className="update-prompt" role="status">
            <p className="update-prompt__message">{message}</p>
            <Button variant="primary" onClick={onApply}>
                {labels.apply}
            </Button>
            <Button onClick={onDismiss}>{labels.dismiss}</Button>
        </div>
    );
};

export { UpdatePrompt, type UpdatePromptProps };
