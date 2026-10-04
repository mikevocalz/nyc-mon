import { tv } from 'tailwind-variants';
import { Text, View } from './tw';
import { TYPE_SCALE_TV } from './type-scale';

/**
 * Props for {@linkcode NotificationPreview}.
 */
export interface NotificationPreviewProps {
  /** The app that sent the notification. */
  appName: string;
  /** The notification title. */
  title: string;
  /** The notification body. */
  body: string;
  /** Timestamp shown in the header. */
  time: string;
  /** The OS banner is the one kit component that is rounded. Default `true`. */
  rounded?: boolean;
  className?: string;
}

const preview = tv(
  {
    slots: {
      root: 'w-full border border-concrete-200 bg-white p-4 shadow-sm',
      header: 'flex-row items-center justify-between gap-2 pb-2',
      app: 'shrink text-type-caption text-concrete-600',
      time: 'text-type-caption text-concrete-600',
      title: 'text-type-body-strong text-ink-950',
      body: 'text-type-body text-ink-950',
    },
    variants: {
      rounded: {
        true: { root: 'rounded-soft' },
        false: {},
      },
    },
    defaultVariants: { rounded: true },
  },
  TYPE_SCALE_TV,
);

/**
 * A static picture of an OS notification banner: white face, concrete-200
 * keyline, soft corners. It is explicitly not theme-following because it is a
 * picture of a system banner. Screen readers hear it as an image announcing the
 * app, title and body.
 */
export function NotificationPreview({
  appName,
  title,
  body,
  time,
  rounded = true,
  className,
}: NotificationPreviewProps) {
  const s = preview({ rounded });
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${appName} notification: ${title}. ${body}`}
      className={s.root({ className })}
    >
      <View className={s.header()}>
        <Text numberOfLines={1} className={s.app()}>
          {appName}
        </Text>
        <Text className={s.time()}>{time}</Text>
      </View>
      <Text numberOfLines={1} className={s.title()}>
        {title}
      </Text>
      <Text numberOfLines={2} className={s.body()}>
        {body}
      </Text>
    </View>
  );
}
