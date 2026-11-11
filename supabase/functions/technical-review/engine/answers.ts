// What the browser may send as answers: only question IDs from the catalog,
// only listed options where a question has them, and bounded free text.
// Anything else is dropped. The endpoint is public, so this keeps junk out
// of marketing.technical_reviews.
import { CHECKS, IDEA_QUESTIONS, INTAKE, SCOPE, STAGE_QUESTION, YES_NO_UNSURE, aboutQuestions } from "./catalog.ts";
import type { Answers, Question } from "./types.ts";

const MAX_TEXT = 2000;
const MAX_ITEMS = 20;

type Rule = { multi: boolean; values: Set<string> | null }; // null = free text

const rules = new Map<string, Rule>();
const fromQuestion = (q: Question) =>
  rules.set(q.id, { multi: q.type === "multi", values: q.options ? new Set(q.options.map((o) => o.value)) : null });

[STAGE_QUESTION, ...aboutQuestions("idea"), ...SCOPE, ...INTAKE, ...IDEA_QUESTIONS.flatMap((g) => g.questions)].forEach(fromQuestion);
for (const def of Object.values(CHECKS)) {
  rules.set(def.id, { multi: false, values: new Set((def.options ?? YES_NO_UNSURE).map((o) => o.value)) });
}

export const ALLOWED_ANSWER_IDS: ReadonlySet<string> = new Set(rules.keys());

export function sanitizeAnswers(input: unknown): Answers {
  const out: Answers = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;

  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    const rule = rules.get(id);
    if (!rule) continue;

    if (rule.multi) {
      if (!Array.isArray(raw)) continue;
      const items = [...new Set(raw.filter((v): v is string => typeof v === "string"))]
        .filter((v) => !rule.values || rule.values.has(v))
        .slice(0, MAX_ITEMS);
      out[id] = items;
      continue;
    }

    if (typeof raw !== "string") continue;
    if (rule.values) {
      if (rule.values.has(raw)) out[id] = raw;
    } else {
      out[id] = raw.slice(0, MAX_TEXT);
    }
  }
  return out;
}
