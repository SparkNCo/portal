// @mentions in chat messages.
//
// People read and type "@Name". In the stored message a mention is a token
// carrying the person's id — "<@uid:ID>", CometChat's own mention format — so
// who was mentioned never depends on how a name is spelled, and the webhook
// can notify exactly that person (see supabase/functions/cometchat).

// `person` tells apart two ids of the same person (someone can be in a chat
// under more than one id); defaults to `id`.
export type MentionOption = { id: string; name: string; person?: string };

// Who to offer in the picker: one entry per person, without `selfId`'s person.
export function mentionablePeople(people: readonly MentionOption[], selfId: string): MentionOption[] {
  const personOf = (o: MentionOption) => o.person ?? o.id;
  const self = people.find((o) => o.id === selfId);
  const selfPerson = self ? personOf(self) : selfId;
  const seen = new Set<string>([selfPerson]);
  return people.filter((o) => {
    const person = personOf(o);
    if (seen.has(person)) return false;
    seen.add(person);
    return true;
  });
}

const TOKEN = /<@uid:([^>\s]+)>/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Ids of everyone mentioned in a stored message text, without repeats.
export function mentionedIds(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN)].map((m) => m[1]!))];
}

// "@Name" → "<@uid:ID>" for the people in `options`, ready to send. Longest
// names first, so "@Ana María" isn't cut short by an "@Ana". A name only
// counts when it ends there (not as the start of a longer word).
export function encodeMentions(text: string, options: readonly MentionOption[]): string {
  let out = text;
  for (const option of [...options].sort((a, b) => b.name.length - a.name.length)) {
    if (!option.name.trim()) continue;
    out = out.replace(new RegExp(`@${escapeRegExp(option.name)}(?![\\w@.-])`, "g"), `<@uid:${option.id}>`);
  }
  return out;
}

// "<@uid:ID>" → "@Name" for showing. Unknown ids fall back to "@someone".
export function decodeMentions(text: string, options: readonly MentionOption[]): string {
  const names = new Map(options.map((o) => [o.id, o.name]));
  return text.replace(TOKEN, (_, id: string) => `@${names.get(id) ?? "someone"}`);
}

// The "@…" being typed right before the caret, if any: where it starts and
// what's been typed after the "@". Only at the start of the text or after a
// space, so an email address doesn't open the picker.
export function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf("@");
  if (start === -1) return null;
  if (start > 0 && !/\s/.test(before[start - 1]!)) return null;
  const query = before.slice(start + 1);
  // Names can have spaces ("Ana María"), but not line breaks, and a long run
  // without a match means the person moved on.
  if (query.includes("\n") || query.length > 40) return null;
  return { start, query };
}

// Who to offer for what's been typed after "@" — name starts with it first,
// then name contains it.
export function matchMentionOptions(options: readonly MentionOption[], query: string, limit = 6): MentionOption[] {
  const q = query.trim().toLowerCase();
  const starts = options.filter((o) => o.name.toLowerCase().startsWith(q));
  const contains = options.filter((o) => !o.name.toLowerCase().startsWith(q) && o.name.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}

// Splits a shown text into plain parts and the "@Name" mentions in it, for
// highlighting. `options` are the people mentioned in that message.
export function splitMentions(
  text: string,
  options: readonly MentionOption[],
): { text: string; mention?: MentionOption }[] {
  const named = options.filter((o) => o.name.trim());
  if (named.length === 0) return [{ text }];
  const byName = new Map(named.map((o) => [`@${o.name}`, o]));
  const pattern = new RegExp(
    `(${[...named].sort((a, b) => b.name.length - a.name.length).map((o) => `@${escapeRegExp(o.name)}`).join("|")})(?![\\w@.-])`,
    "g",
  );
  const parts: { text: string; mention?: MentionOption }[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[0], mention: byName.get(match[0]) });
    last = match.index! + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
