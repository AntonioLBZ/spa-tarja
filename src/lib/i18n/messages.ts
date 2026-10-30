import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';

import type { AppLocale } from './locale';

type AppMessages = typeof en;

// Typed against English, so a missing key in another language fails the build
const MESSAGES: Record<AppLocale, AppMessages> = { en, es };

export { MESSAGES, type AppMessages };
