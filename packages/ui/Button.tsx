'use client';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { palette } from '@acme/theme';
import { PressScale } from './press-scale';
import { Text, View } from './tw';
import { haptics } from './haptics';
import { button, CUT_FACE } from './Button.styles';
import { useIsHeadset } from './use-is-headset';
import { CornerCutFrame } from './neon/CornerCutFrame';
import { ROUND_RADIUS } from './neon/corner-cut';
import type { CutCorner } from './neon/corner-cut';
import type { GlowIntensity } from './neon/glow';
import { TONE_CLASSES, toneHex, type ControlTone, type District } from './district';
import { DISABLED_FRAME_TONE, controlLook, frameTone, outerLayout, type ButtonVariant, type ControlLook } from './control-look';

// The NYC-MON button. Solid and outline looks draw a CornerCutFrame inside
// the pressable, so the root only owns the hit area, focus ring and press
// sink (web: the face drops into its depth plate; native: PressScale's
// spring). Ghost has no frame: a tone label and a soft tint on hover.
// motion-reduce kills the transitions. Classes, label ramp and target floor
// live in Button.styles.ts.

// Solid labels sit on the tone face, outline labels on the night face, ghost
// labels straight on the page, so ghost takes the themed page step.
function labelTone(look: ControlLook, tone: ControlTone) {
  const c = TONE_CLASSES[tone];
  return look === 'solid' ? c.onFace : look === 'ghost' ? c.pageText : c.text;
}

export interface ButtonProps {
  /** Opt-in rounded corners (rounded-soft) in place of the neon corner cut. Default false: square, cut. */
  rounded?: boolean;
  title: string;
  /** A glyph before the label (decorative; the title names the button). Size it to the label. */
  icon?: ReactNode;
  /**
   * Default (no variant, `cornerCut` or `neon`): the solid corner-cut face.
   * Legacy names keep working: primary = default, accent = the district's
   * second tone (royal in Midtown), danger = apple, outline = night face
   * with a tone border, ghost = no frame, tone label. `cta` = the screen's one
   * primary call to action: brand orange face, `on-cta` label, any tone ignored.
   * `hlynk-care` = the care bar on the live scene (M13): signage-black face,
   * `silver-300` glyph and label, 48 pt tall, tone and district ignored.
   */
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
  /** Colour family. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood (Downtown royal, Midtown orange, Harlem brick, Mega City carolina). Default Midtown. */
  district?: District;
  /** Which corner is cut. Default bottom-right. */
  corner?: CutCorner;
  /** Accent glow around the cut shape. Off by default. */
  glow?: boolean | GlowIntensity;
  onPress?: () => void;
  loading?: boolean;
  className?: string;
  'aria-label'?: string;
  /** Test id on the pressable, so screens need no wrapper View to find it. */
  testID?: string;
  /**
   * Extra context read after the label ("Goes to the last page"). Native only
   * where the platform honours it; on web it lands as aria-description.
   */
  accessibilityHint?: string;
}

export function Button({
  title, icon, onPress, variant, size = 'md', disabled, fullWidth, loading, className,
  tone: toneProp, district, corner = 'bottom-right', glow = false, rounded = false, testID, ...a11y
}: ButtonProps) {
  const { look, tone } = controlLook(variant, toneProp, district);
  const off = !!(disabled || loading);
  const xr = useIsHeadset();
  const s = button({ look, size, xr, disabled: off, fullWidth });
  // cta labels read the on-cta token (signage black by day, night after dark), not the tone table.
  const care = variant === 'hlynk-care';
  const labelClass = s.label({
    className: off ? undefined : variant === 'cta' ? 'text-on-cta' : care ? 'text-silver-300 group-active:text-signage-white' : labelTone(look, tone),
  });
  const content = (
    <>
      {loading ? (
        // ActivityIndicator takes a colour prop, not a class: the label colour on this face.
        <ActivityIndicator size="small" color={look === 'solid' && !off ? toneHex(tone).on : undefined} />
      ) : null}
      {icon ? <View aria-hidden className="items-center justify-center">{icon}</View> : null}
      <Text className={labelClass}>{title}</Text>
    </>
  );
  return (
    <PressScale
      onPress={off ? undefined : () => { haptics.tap(); onPress?.(); }}
      aria-disabled={off}
      accessibilityState={{ disabled: off }}
      className={s.root({ className: `${rounded ? 'rounded-soft' : ''} ${className ?? ''}` })}
      outerClassName={fullWidth ? 'w-full' : outerLayout(className)}
      {...a11y}
      // The web press base is a real <button>, which takes data-testid; RN's Pressable takes testID.
      {...(testID === undefined ? {} : Platform.OS === 'web' ? { 'data-testid': testID } : { testID })}
    >
      {look === 'ghost' ? (
        <>
          <View aria-hidden className={s.tint({ className: TONE_CLASSES[tone].soft })} />
          {content}
        </>
      ) : (
        <CornerCutFrame
          radius={rounded ? ROUND_RADIUS : 0}
          tone={off ? DISABLED_FRAME_TONE : care ? palette.signage.black : frameTone(look, tone)}
          variant={off || look === 'outline' ? 'outline' : 'solid'}
          corner={corner}
          cut={CUT_FACE[size].cut}
          depth={off || care ? 0 : 4}
          glow={off ? false : glow}
          className={`flex-row items-center justify-center gap-2 ${CUT_FACE[size].className} ${care ? 'min-h-target' : ''}`}
        >
          {content}
        </CornerCutFrame>
      )}
    </PressScale>
  );
}
