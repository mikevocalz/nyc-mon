'use client';
import { useActionState, useEffect, useId, useRef, type FormEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { CornerCutFrame } from '@acme/ui/neon';
import {
  Button,
  Fieldset,
  Form,
  Heading,
  Input,
  Label,
  Legend,
  Link,
  Output,
  Paragraph,
  Text,
} from '@acme/ui/html';
import { useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { useDistrictStore } from '@acme/spatial/district';
import { joinWaitlistAction, type WaitlistFormState } from '../../app/(site)/get/actions';
import { keepsEntries, waitlistMessage, WAITLIST_COPY } from './copy';

const INITIAL: WaitlistFormState = { status: 'idle', email: '' };

/** Errors found in the browser before the form posts; null when the field is fine. */
interface ClientErrors {
  email: string | null;
  age: string | null;
}
const NO_ERRORS: ClientErrors = { email: null, age: null };

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
 * moves to the confirmation heading, on `invalid` to the email field, whose
 * error is tied to it by `aria-describedby` (WCAG 3.3.1, 3.3.3, 4.1.3).
 *
 * The browser's validation bubbles are off (`noValidate`): an empty or
 * malformed email and an unchecked age box are caught on submit and shown as
 * text under the field, with `aria-invalid`, and focus goes to the first one.
 * The server still validates everything; without JavaScript the post goes
 * straight to it and its `invalid` answer uses the same path.
 */
export function WaitlistForm({ source, className }: { source: WaitlistSource; className?: string }) {
  const [state, formAction, isPending] = useActionState(joinWaitlistAction, INITIAL);
  const district = useDistrictStore((s) => s.district);
  const id = useId();
  const emailRef = useRef<{ focus: () => void }>(null);
  const copy = WAITLIST_COPY.form;
  const message = waitlistMessage(state);
  const checks = useInstanceStore(() => ({ errors: NO_ERRORS }));
  const clientErrors = useStore(checks, (st) => st.errors);
  const serverEmailError = message?.field === 'email' ? message.body : null;
  const emailError = clientErrors.email ?? serverEmailError;
  const ageError = clientErrors.age;
  const entered = keepsEntries(state.status);

  const ids = {
    title: `${id}-title`,
    email: `${id}-email`,
    emailError: `${id}-email-error`,
    age: `${id}-age`,
    ageError: `${id}-age-error`,
    ageHint: `${id}-age-hint`,
    privacy: `${id}-privacy`,
    status: `${id}-status`,
    honeypot: `${id}-website`,
    done: `${id}-done`,
    doneBody: `${id}-done-body`,
    submit: `${id}-submit`,
  };

  // Each answer is a new state object, so a repeat answer (a second invalid) moves focus again.
  useEffect(() => {
    if (state.status === 'joined') document.getElementById(ids.done)?.focus();
    if (state.status === 'invalid') emailRef.current?.focus();
    // The disabled (pending) button dropped focus; hand it back so the next Tab starts from the form.
    // The result itself is read from the live region.
    if (state.status === 'under13' || state.status === 'rate_limited' || state.status === 'error') {
      document.getElementById(ids.submit)?.focus();
    }
  }, [state, ids.done, ids.submit]);

  // Runs before the action. A failing check stops the post and focuses the first bad field.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const fields = event.currentTarget.elements;
    const email = fields.namedItem('email') as HTMLInputElement | null;
    const age = fields.namedItem('ageConfirmed') as HTMLInputElement | null;
    const typed = email?.value.trim() ?? '';
    const errors: ClientErrors = {
      email: typed === '' ? copy.emailMissing : email && !email.validity.valid ? copy.emailInvalid : null,
      age: age && !age.checked ? copy.ageMissing : null,
    };
    checks.setState({ errors });
    if (!errors.email && !errors.age) return;
    event.preventDefault();
    (errors.email ? email : age)?.focus();
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

      <Fieldset className="m-0 gap-2 border-0 p-0">
        <Legend className="mb-2 p-0 font-display text-base uppercase tracking-wide text-text">{copy.ageLegend}</Legend>
        <View className="flex-row items-start gap-3">
          <Input
            id={ids.age}
            name="ageConfirmed"
            type="checkbox"
            required
            defaultChecked={entered}
            aria-invalid={ageError ? true : undefined}
            aria-describedby={ageError ? `${ids.ageError} ${ids.ageHint}` : ids.ageHint}
            className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          />
          <Label htmlFor={ids.age} className="min-h-6 cursor-pointer text-base font-semibold leading-6 text-text">
            {copy.ageLabel}
          </Label>
        </View>
        <View className="gap-1 pl-9">
          {ageError ? (
            <Paragraph id={ids.ageError} className="my-0 text-base font-semibold leading-6 text-danger">
              {ageError}
            </Paragraph>
          ) : null}
          <Paragraph id={ids.ageHint} className="my-0 text-sm leading-6 text-text-secondary">
            {copy.ageHint}
          </Paragraph>
        </View>
      </Fieldset>

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
