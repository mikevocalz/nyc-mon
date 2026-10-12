'use client';
import { useActionState, useEffect, useId, useRef, type FormEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { CornerCutFrame } from '@acme/ui/neon';
import {
  Button,
  Form,
  Heading,
  Input,
  Label,
  Link,
  Output,
  Paragraph,
  Text,
} from '@acme/ui/html';
import { useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { useDistrictStore } from '@acme/spatial/district';
import { joinWaitlistAction, type WaitlistFormState } from '../../app/(site)/get/actions';
import { birthYearError, waitlistMessage, WAITLIST_COPY } from './copy';

const INITIAL: WaitlistFormState = { status: 'idle', email: '' };

/** Errors found in the browser before the form posts; null when the field is fine. */
interface ClientErrors {
  email: string | null;
  birthYear: string | null;
}
const NO_ERRORS: ClientErrors = { email: null, birthYear: null };

/** Which page the form sits on; stored with the sign-up as `source`. */
export type WaitlistSource = 'home' | 'get';

/** The submit button. Reads the form's pending state, so it must render inside the form. */
function SubmitButton({ id }: { id: string }) {
  const { pending } = useFormStatus();
  const copy = WAITLIST_COPY.form;
  return (
    <Button
      id={id}
      type="submit"
      disabled={pending}
      className="group w-full items-stretch self-stretch rounded-none no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-progress sm:w-auto sm:self-start"
    >
      <CornerCutFrame
        tone="orange"
        variant="solid"
        corner="bottom-right"
        cut={18}
        depth={4}
        className="min-h-14 flex-row items-center justify-center px-8 py-4 md:px-10"
      >
        <Text className="whitespace-nowrap font-display text-base tracking-wide text-on-cta md:text-lg">
          {pending ? copy.pending : copy.submit}
        </Text>
      </CornerCutFrame>
    </Button>
  );
}

/**
 * The waitlist form (PS-001, PS-023). A plain `<form>` whose action is the
 * `joinWaitlistAction` server action through `useActionState`, so it posts
 * and renders its result before hydration too (progressive enhancement).
 * State lives only in the action state: no useState / useReducer. The
 * district rides along from the hero's picker (the shared Zustand store).
 *
 * Announcements: a polite `<output>` carries the result; on `joined` focus
 * moves to the confirmation heading, on `under13` to the note that replaces
 * the form, on `invalid` to the field it names, whose error is tied to it by
 * `aria-describedby` (WCAG 3.3.1, 3.3.3, 4.1.3).
 *
 * Age screen (docs/design/site/WAITLIST_AGE_SCREEN.md): a birth-year field
 * with no default and no hint at which years can join, like the app's M04
 * gate. admin-vite applies the age rule. An `under13` answer replaces the
 * form with a note and no way back to it in this page; the server action's
 * hold cookie covers a reload.
 *
 * The browser's validation bubbles are off (`noValidate`): an empty or
 * malformed email and a missing or malformed year are caught on submit and
 * shown as text under the field, with `aria-invalid`, and focus goes to the
 * first one. The server still validates everything; without JavaScript the
 * post goes straight to it and its `invalid` answer uses the same path.
 */
export function WaitlistForm({ source, className }: { source: WaitlistSource; className?: string }) {
  const [state, formAction, isPending] = useActionState(joinWaitlistAction, INITIAL);
  const district = useDistrictStore((s) => s.district);
  const id = useId();
  const emailRef = useRef<{ focus: () => void }>(null);
  const yearRef = useRef<{ focus: () => void }>(null);
  const copy = WAITLIST_COPY.form;
  const message = waitlistMessage(state);
  const checks = useInstanceStore(() => ({ errors: NO_ERRORS }));
  const clientErrors = useStore(checks, (st) => st.errors);
  const serverEmailError = message?.field === 'email' ? message.body : null;
  const emailError = clientErrors.email ?? serverEmailError;
  const serverYearError = message?.field === 'birthYear' ? message.body : null;
  const yearError = clientErrors.birthYear ?? serverYearError;

  const ids = {
    title: `${id}-title`,
    email: `${id}-email`,
    emailError: `${id}-email-error`,
    year: `${id}-birth-year`,
    yearError: `${id}-birth-year-error`,
    yearHint: `${id}-birth-year-hint`,
    privacy: `${id}-privacy`,
    status: `${id}-status`,
    honeypot: `${id}-website`,
    done: `${id}-done`,
    held: `${id}-held`,
    doneBody: `${id}-done-body`,
    submit: `${id}-submit`,
  };

  // Each answer is a new state object, so a repeat answer (a second invalid) moves focus again.
  useEffect(() => {
    if (state.status === 'joined') document.getElementById(ids.done)?.focus();
    if (state.status === 'under13') document.getElementById(ids.held)?.focus();
    if (state.status === 'invalid') (state.field === 'birthYear' ? yearRef : emailRef).current?.focus();
    // The disabled (pending) button dropped focus; hand it back so the next Tab starts from the form.
    // The result itself is read from the live region.
    if (state.status === 'rate_limited' || state.status === 'error') {
      document.getElementById(ids.submit)?.focus();
    }
  }, [state, ids.done, ids.held, ids.submit]);

  // Runs before the action. A failing check stops the post and focuses the first bad field.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const fields = event.currentTarget.elements;
    const email = fields.namedItem('email') as HTMLInputElement | null;
    const year = fields.namedItem('birthYear') as HTMLInputElement | null;
    const typed = email?.value.trim() ?? '';
    const errors: ClientErrors = {
      email: typed === '' ? copy.emailMissing : email && !email.validity.valid ? copy.emailInvalid : null,
      birthYear: year ? birthYearError(year.value, new Date().getUTCFullYear()) : null,
    };
    checks.setState({ errors });
    if (!errors.email && !errors.birthYear) return;
    event.preventDefault();
    (errors.email ? email : year)?.focus();
  };

  // Field errors are read through the field (focus + aria-describedby); everything else goes to the live region.
  const live = message && !message.field ? message.body : '';

  if (state.status === 'joined' && message) {
    return (
      <View className={`gap-3 border-l-4 border-success py-2 pl-5 ${className ?? ''}`} testID="waitlist-joined">
        <Heading
          level={3}
          id={ids.done}
          tabIndex={-1}
          aria-describedby={ids.doneBody}
          className="my-0 font-display text-2xl uppercase leading-tight text-text outline-none md:text-3xl"
        >
          {message.title}
        </Heading>
        <Paragraph id={ids.doneBody} className="my-0 max-w-content-measure text-base leading-7 text-text-secondary">
          {message.body}
        </Paragraph>
      </View>
    );
  }

  // The age screen's answer. The form does not come back in this page: the
  // next step is a grown-up's, with their own email (no retry, no other year).
  if (state.status === 'under13' && message) {
    return (
      <View className={`gap-3 border-l-4 border-text-secondary py-2 pl-5 ${className ?? ''}`} testID="waitlist-under13">
        <Paragraph
          id={ids.held}
          tabIndex={-1}
          className="my-0 max-w-content-measure text-base leading-7 text-text outline-none"
        >
          {message.body}
        </Paragraph>
        {message.link ? (
          <Paragraph className="my-0 text-sm leading-6 text-text-secondary">
            <Link href={message.link.href} className="inline-flex min-h-6 items-center text-text underline underline-offset-4">
              {message.link.label}
            </Link>
          </Paragraph>
        ) : null}
      </View>
    );
  }

  return (
    <Form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      aria-label={copy.name}
      aria-busy={isPending}
      data-testid="waitlist-form"
      className={`w-full max-w-xl gap-6 ${className ?? ''}`}
    >
      <Input type="hidden" name="source" defaultValue={source} />
      <Input type="hidden" name="district" defaultValue={district} />

      {/* Honeypot. People never see it and assistive technology skips it; a bot that fills it gets a quiet "joined". */}
      <View aria-hidden className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <Label htmlFor={ids.honeypot}>{copy.honeypotLabel}</Label>
        <Input id={ids.honeypot} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </View>

      <View className="gap-2">
        <Label htmlFor={ids.email} className="font-display text-base uppercase tracking-wide text-text">
          {copy.emailLabel}
        </Label>
        <Input
          ref={emailRef}
          id={ids.email}
          name="email"
          type="email"
          required
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          maxLength={254}
          defaultValue={state.email}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? ids.emailError : undefined}
          className={`h-14 w-full rounded-none border-2 bg-surface-raised px-4 text-lg font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${emailError ? 'border-danger' : 'border-text'}`}
        />
        {emailError ? (
          <Paragraph id={ids.emailError} className="my-0 text-base font-semibold leading-6 text-danger">
            {emailError}
          </Paragraph>
        ) : null}
      </View>

      {/* Neutral age screen: no default, no placeholder year, no hint at which years can join. */}
      <View className="gap-2">
        <Label htmlFor={ids.year} className="font-display text-base uppercase tracking-wide text-text">
          {copy.birthYearLabel}
        </Label>
        <Paragraph id={ids.yearHint} className="my-0 text-sm leading-6 text-text-secondary">
          {copy.birthYearHint}
        </Paragraph>
        <Input
          ref={yearRef}
          id={ids.year}
          name="birthYear"
          type="text"
          required
          keyboardType="number-pad"
          maxLength={4}
          autoComplete="off"
          autoCorrect={false}
          spellCheck={false}
          defaultValue=""
          aria-invalid={yearError ? true : undefined}
          aria-describedby={yearError ? `${ids.yearError} ${ids.yearHint}` : ids.yearHint}
          className={`h-14 w-40 rounded-none border-2 bg-surface-raised px-4 text-lg font-semibold tabular-nums text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${yearError ? 'border-danger' : 'border-text'}`}
        />
        {yearError ? (
          <Paragraph id={ids.yearError} className="my-0 text-base font-semibold leading-6 text-danger">
            {yearError}
          </Paragraph>
        ) : null}
      </View>

      <View className="gap-4">
        <SubmitButton id={ids.submit} />
        {/* Always mounted so the result is announced; it takes no room while empty. */}
        <View>
          <Output
            id={ids.status}
            className={`block text-base leading-7 ${live ? 'pb-4' : ''} ${message?.tone === 'error' ? 'font-semibold text-danger' : 'text-text'}`}
          >
            {live}
          </Output>
          <Paragraph id={ids.privacy} className="my-0 text-sm leading-6 text-text-secondary">
            {copy.privacy}{' '}
            <Link href={copy.privacyHref} className="inline-flex min-h-6 items-center text-text underline underline-offset-4">
              {copy.privacyLink}
            </Link>
          </Paragraph>
        </View>
      </View>
    </Form>
  );
}
