import { createFileRoute } from '@tanstack/react-router';

import { CategoryManager } from '@/features/categories/category-manager';

export const Route = createFileRoute('/categories')({ component: CategoryManager });
