import { createFileRoute } from '@tanstack/react-router';

import { JoinScreen } from '@/features/groups/join-screen';

const Join = () => {
    const { token } = Route.useParams();

    return <JoinScreen token={token} />;
};

export const Route = createFileRoute('/join/$token')({ component: Join });
