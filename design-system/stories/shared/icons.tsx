import { Icon } from '@/components/icon/icon';
import { UI_ICONS } from '@/components/icon/icon-paths';

import type { IconName } from '@/components/icon/icon-paths';

// What an icon control offers: no icon, or one of the interface
type IconChoice = IconName | 'none';

const ICON_CHOICES: readonly IconChoice[] = ['none', ...UI_ICONS];

// The control of an icon, as a story's `argTypes` takes it
const ICON_CONTROL = { control: 'select', options: ICON_CHOICES } as const;

const iconOf = (choice: IconChoice) => (choice === 'none' ? undefined : <Icon name={choice} />);

export { ICON_CHOICES, ICON_CONTROL, iconOf, type IconChoice };
