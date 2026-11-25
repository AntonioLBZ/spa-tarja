import { createFileRoute } from '@tanstack/react-router';

import { GroupExport } from '@/features/groups/group-export';

const ExportGroup = () => {
    const { groupId } = Route.useParams();

    return <GroupExport groupId={groupId} />;
};

export const Route = createFileRoute('/groups/$groupId/export')({ component: ExportGroup });
