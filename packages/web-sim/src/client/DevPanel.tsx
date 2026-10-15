import { useCallback, useEffect } from 'react';
import type { Client, Tool } from '@modelcontextprotocol/client';
import { Button, Select, Slider, SolidPanel, useInstanceStore, useStore } from '@acme/ui';
import { Heading, List, ListItem, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import type { ConversionResult } from '../shared/toolSpec.ts';
import { useSetters } from './state.ts';

/**
 * Dev mode only: inject seeded presence events (ADR 0015 §2: fictional people,
 * no real voiceprints) and see which MCP tools the model was given. Calls go
 * straight to the MCP server's dev tool; the model never sees that tool.
 */

interface Person {
  readonly personId: string;
  readonly callerId: string | null;
  readonly displayName: string;
}

export function extractPeople(structured: unknown): Person[] {
  const out: Person[] = [];
  const visit = (v: unknown, depth: number) => {
    if (depth > 4 || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach((x) => visit(x, depth + 1));
    const o = v as Record<string, unknown>;
    if (typeof o.personId === 'string') {
      out.push({
        personId: o.personId,
        callerId: typeof o.callerId === 'string' ? o.callerId : null,
        displayName: typeof o.displayName === 'string' ? o.displayName : o.personId,
      });
      return;
    }
    Object.values(o).forEach((x) => visit(x, depth + 1));
  };
  visit(structured, 0);
  return out.filter((p, i, a) => a.findIndex((q) => q.personId === p.personId) === i);
}

/**
 * Arguments for the server's presence hook, built from its declared schema so
 * the panel follows the MCP server's contract instead of guessing it.
 */
export function presenceArgs(injectTool: Tool, person: Person, confidence: number, now: number): Record<string, unknown> {
  const props = (injectTool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
  const args: Record<string, unknown> = { personId: person.personId, confidence };
  if ('monInstanceId' in props) args.monInstanceId = null;
  if ('callerId' in props && person.callerId) args.callerId = person.callerId;
  if ('ts' in props) args.ts = now;
  if ('source' in props) args.source = 'web-vad';
  return args;
}

export function DevPanel(props: {
  readonly client: Client | null;
  readonly injectTool: Tool | undefined;
  readonly conversion: ConversionResult | null;
  readonly onNotice: (text: string, tone: 'info' | 'error') => void;
}) {
  const { client, injectTool, onNotice } = props;
  const hasInjectTool = injectTool !== undefined;
  const store = useInstanceStore<{ people: Person[]; personId: string; confidence: number; busy: boolean }>(() => ({
    people: [],
    personId: '',
    confidence: 0.93,
    busy: false,
  }));
  const { people, personId, confidence, busy } = useStore(store);
  const { people: setPeople, personId: setPersonId, confidence: setConfidence, busy: setBusy } = useSetters(store);

  const loadPeople = useCallback(async () => {
    if (!client) return;
    try {
      const res = await client.callTool({ name: 'get_familiar_people', arguments: {} });
      const found = extractPeople(res.structuredContent);
      setPeople(found);
      setPersonId((cur) => cur || found[0]?.personId || '');
    } catch (err) {
      onNotice(`Couldn’t load familiar people: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [client, onNotice, setPeople, setPersonId]);

  useEffect(() => {
    if (hasInjectTool) void loadPeople();
  }, [hasInjectTool, loadPeople]);

  const person = people.find((p) => p.personId === personId);
  const tier = confidence >= 0.9 ? 'greets them' : confidence >= 0.7 ? 'hedges' : 'stays quiet';

  async function inject() {
    if (!client || !person || !injectTool) return;
    setBusy(true);
    try {
      const res = await client.callTool({
        name: injectTool.name,
        arguments: presenceArgs(injectTool, person, confidence, Date.now()),
      });
      if (res.isError) {
        const msg = (res.content ?? []).map((c) => (c.type === 'text' ? c.text : '')).join(' ');
        onNotice(`The server refused the presence event: ${msg || 'no reason given'}`, 'error');
      } else {
        onNotice(`Seeded: ${person.displayName} detected nearby at ${confidence.toFixed(2)}. Talk to your Mon to see it react.`, 'info');
      }
    } catch (err) {
      onNotice(`Presence event failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SolidPanel surface="page" depth="lg">
      <Section aria-labelledby="devpanel-title" className="gap-4 px-5 py-6">
        <Heading level={2} id="devpanel-title" className="my-0 font-display text-xl leading-tight text-text">
          Dev panel
        </Heading>
        <Paragraph className="my-0 text-sm text-text-secondary">Seeded test data. Nobody’s voice is recorded or stored.</Paragraph>

        <Heading level={3} className="my-0 text-base font-semibold text-text">
          Presence event
        </Heading>
        {!hasInjectTool ? (
          <Paragraph className="my-0 text-sm text-text-secondary">
            The MCP server isn’t in dev mode. Start it with MCP_DEV_MODE=1 to seed presence.
          </Paragraph>
        ) : people.length === 0 ? (
          <View className="gap-2">
            <Paragraph className="my-0 text-sm text-text-secondary">No familiar people on this account.</Paragraph>
            <View className="flex-row">
              <Button variant="ghost" size="sm" title="Check again" onPress={() => void loadPeople()} />
            </View>
          </View>
        ) : (
          <View className="gap-4">
            <Select
              district="midtown"
              label="Person"
              value={personId}
              onValueChange={setPersonId}
              options={people.map((p) => ({ value: p.personId, label: p.displayName }))}
            />
            <Slider
              label={`Confidence ${confidence.toFixed(2)}, the Mon ${tier}`}
              value={confidence}
              onValueChange={setConfidence}
              min={0.5}
              max={1}
              step={0.01}
            />
            <View className="flex-row">
              <Button variant="outline" title="Seed presence event" loading={busy} disabled={!person} onPress={() => void inject()} />
            </View>
          </View>
        )}

        <Heading level={3} className="my-0 text-base font-semibold text-text">
          Tools the model gets
        </Heading>
        {props.conversion ? (
          <View className="gap-2">
            <List className="m-0 list-none gap-1 p-0">
              {props.conversion.tools.map((t) => (
                <ListItem key={t.name}>
                  <Text className="text-sm text-text">{t.name}</Text>
                </ListItem>
              ))}
            </List>
            {props.conversion.skipped.length > 0 ? (
              <>
                <Paragraph className="my-0 text-sm text-text-secondary">Held back from the model:</Paragraph>
                <List className="m-0 list-none gap-1 p-0">
                  {props.conversion.skipped.map((sk) => (
                    <ListItem key={sk.name}>
                      <Text className="text-sm text-text-secondary">{`${sk.name}: ${sk.reason}`}</Text>
                    </ListItem>
                  ))}
                </List>
              </>
            ) : null}
          </View>
        ) : (
          <Paragraph className="my-0 text-sm text-text-secondary">Not connected yet.</Paragraph>
        )}
      </Section>
    </SolidPanel>
  );
}
