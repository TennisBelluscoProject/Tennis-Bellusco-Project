'use client';

/**
 * Punto d'ingresso unico delle primitive d'interfaccia.
 *
 * I componenti veri stanno in `components/ui/*`; questo file li riespone con
 * i nomi storici. Serve a una cosa sola ma importante: il resto dell'app
 * importa da `@/components/UI` in una trentina di punti, e cosi' il
 * redesign puo' sostituire le primitive senza toccare nessun chiamante.
 *
 * Da qui in avanti conviene importare direttamente da `@/components/ui/...`;
 * questo barile resta per compatibilita'.
 */

export { Button, IconButton } from './ui/Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './ui/Button';

export { Input, Textarea, Select, Checkbox, SearchBar, Switch, Slider } from './ui/Field';

export { Dialog, Modal, ConfirmDialog } from './ui/Dialog';
export type { DialogProps, ConfirmDialogProps } from './ui/Dialog';

export { Tabs, SegmentedControl } from './ui/Tabs';
export type { TabItem } from './ui/Tabs';

export {
  Badge,
  ProgressBar,
  AnimatedNumber,
  StatCard,
  Spinner,
  Skeleton,
  SkeletonList,
  LoadingScreen,
  EmptyState,
  Divider,
  DelayedFallback,
} from './ui/Feedback';

export { ToastProvider, useToast } from './ui/Toast';
export type { ToastOptions, ToastTone } from './ui/Toast';

export { AnimatedThemeToggler } from './ui/AnimatedThemeToggler';

export { Logo, LogoMark } from './Logo';
