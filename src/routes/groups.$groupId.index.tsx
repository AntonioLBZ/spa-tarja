import { createFileRoute } from '@tanstack/react-router';

import { GroupScreen } from '@/features/groups/screen/group-screen';

const Group = () => {
    const { groupId } = Route.useParams();

    return <GroupScreen groupId={groupId} />;
};

export const Route = createFileRoute('/groups/$groupId/')({ component: Group });
