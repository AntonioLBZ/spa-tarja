import { createFileRoute } from '@tanstack/react-router';

import { GroupSettings } from '@/features/groups/group-settings';

const EditGroup = () => {
    const { groupId } = Route.useParams();

    return <GroupSettings groupId={groupId} />;
};

export const Route = createFileRoute('/groups/$groupId/edit')({ component: EditGroup });
