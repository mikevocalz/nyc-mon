'use client';
import type { ComponentType } from 'react';
import { Pressable as CanonicalPressable } from '../tw';
import type { StudioPressableProps } from './types';

/** The kit's native semantic Pressable already implements RN render callbacks. */
export const StudioPressable = CanonicalPressable as ComponentType<StudioPressableProps>;
