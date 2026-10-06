'use client';

import { useState } from 'react';
import { Badge, Button, SolidPanel, TextField } from '@acme/ui';
import { Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { Text, View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { W05_COPY } from './copy';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The waitlist capture. This site has no backend (ADR 0003), so submit does no
 * POST — a valid email flips to the confirmation state in place.
 *
 * The fields sit in a plain View, not the Form primitive: inside a real <form>
 * the browser's implicit submission would reload the page on Enter, which is
 * the fake POST we're avoiding.
 */
function WaitlistForm() {
  const copy = W05_COPY.form;
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [joined, setJoined] = useState(false);

  const submit = () => {
    if (!EMAIL_PATTERN.test(email)) {
      setError(copy.errorInvalid);
      return;
    }
    setError(undefined);
    setJoined(true);
  };

  if (joined) {
    return (
      <View role="status" aria-live="polite">
        <SolidPanel surface="page" depth="md" className="max-w-xl gap-2 px-5 py-6">
          <Paragraph className="my-0 font-display text-xl text-text">{copy.confirmedTitle}</Paragraph>
          <Paragraph className="my-0 text-base leading-7 text-text-secondary">{copy.confirmedBody}</Paragraph>
        </SolidPanel>
      </View>
    );
  }

  // items-start + the label-height offset: the button aligns to the input
  // band itself, so hint/error text growing below the field never shifts it.
  // size sm puts the framed face at the input's min-h-11.
  return (
    <View className="w-full max-w-xl gap-3 sm:flex-row sm:items-start">
      <TextField
        surface="daylit"
        containerClassName="flex-1"
        label={copy.label}
        hint={copy.hint}
        placeholder={copy.placeholder}
        value={email}
        error={error}
        onChangeText={(text) => {
          setEmail(text);
          if (error !== undefined) setError(undefined);
        }}
        onSubmitEditing={submit}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Button
        variant="cta"
        size="sm"
        title={copy.submit}
        onPress={submit}
        className="w-full sm:mt-6 sm:w-auto"
      />
    </View>
  );
}

/** W05, the waitlist page. */
export function GetPage() {
  const copy = W05_COPY;
  return (
    <View className="w-full flex-1 bg-bg">
      <Section
        aria-labelledby="w05-get-title"
        data-testid="w05-get"
        className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8"
      >
        <View className="max-w-2xl gap-4">
          <Eyebrow>{copy.hero.eyebrow}</Eyebrow>
          <Heading
            level={1}
            id="w05-get-title"
            className="my-0 font-display text-4xl leading-tight text-text md:text-5xl"
          >
            {copy.hero.title}
          </Heading>
          <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">
            {copy.hero.body}
          </Paragraph>
        </View>
        <WaitlistForm />
        <List aria-label={copy.stores.label} className="m-0 list-none gap-6 p-0 sm:flex-row">
          {copy.stores.badges.map((badge) => (
            <ListItem key={badge.name} className="flex-1">
              <SolidPanel
                surface="page"
                depth="sm"
                rim={false}
                className="h-full flex-row items-center justify-between gap-3 px-5 py-4"
              >
                <Text className="font-display text-lg text-text-muted">{badge.name}</Text>
                <Badge label={badge.note} tone="neutral" />
              </SolidPanel>
            </ListItem>
          ))}
        </List>
      </Section>
    </View>
  );
}
