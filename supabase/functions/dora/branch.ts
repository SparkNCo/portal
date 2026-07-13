// @ts-nocheck

// Matches branch prefixes this DORA flow is allowed to derive events from.
// Anything else (release/, chore/, numeric-only, etc.) is intentionally excluded.
const QUALIFYING_PREFIX_RE = /^(feat|fix)\//i;

// Linear identifiers look like "SPA-123": one or more letters, a dash, digits.
const LINEAR_ID_RE = /([A-Za-z]{1,10}-\d{1,6})/;

export type QualifyingBranchType = "feat" | "fix";

export interface QualifyingBranch {
  type: QualifyingBranchType;
  linearId: string;
}

// Parses branch names such as "feat/SPA-123-add-login" or "fix/SPA-456".
// Returns null for unsupported prefixes or branches without a parseable Linear
// identifier, so callers can safely ignore/exclude them per the DORA spec.
export function parseQualifyingBranch(branchName: string | null | undefined): QualifyingBranch | null {
  if (!branchName) return null;

  const prefixMatch = QUALIFYING_PREFIX_RE.exec(branchName);
  if (!prefixMatch) return null;

  const idMatch = LINEAR_ID_RE.exec(branchName.slice(prefixMatch[0].length));
  if (!idMatch) return null;

  return {
    type: prefixMatch[1].toLowerCase() as QualifyingBranchType,
    linearId: idMatch[1].toUpperCase(),
  };
}

export function computeDurationHours(startIso: string, endIso: string): number {
  return Number.parseFloat(
    ((new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000).toFixed(2),
  );
}
