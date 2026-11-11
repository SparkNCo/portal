// Evaluates in-page conditions (`showIf`, `textVariants`). The browser runs
// the same logic to show follow-up questions without asking the server.
import type { Answers, Cond, Question } from "./types.ts";

export function evalCond(cond: Cond, answers: Answers): boolean {
  if ("all" in cond) return cond.all.every((c) => evalCond(c, answers));
  if ("not" in cond) return !evalCond(cond.not, answers);
  const value = answers[cond.q];
  if ("in" in cond) return typeof value === "string" && cond.in.includes(value);
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return cond.anyOf.some((v) => list.includes(v));
}

export function isShown(question: Question, answers: Answers): boolean {
  return !question.showIf || evalCond(question.showIf, answers);
}

export function questionText(question: Question, answers: Answers): string {
  return question.textVariants?.find((v) => evalCond(v.when, answers))?.text ?? question.text;
}
