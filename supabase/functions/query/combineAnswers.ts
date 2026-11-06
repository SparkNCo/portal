// Merges the per-connection answers of one question into a single table.
// Pure — no AI involved: the AI never sees client data, so the merge is done
// here, not by asking it to summarize the rows.

export type ConnectionAnswer = {
  dataSourceId: string;
  dataSourceName: string;
  explanation: string;
  sql: string;
  columns?: string[];
  rows?: unknown[][];
  truncated?: boolean;
  error?: string;
  // The AI judged this database can't answer the question (not a failure).
  unanswerable?: boolean;
  aiBusy?: boolean;
};

export type CombinedResult = {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
};

export const CONNECTION_COLUMN = "Connection";

// Columns match by name, ignoring case and surrounding spaces. A name that
// repeats within one result (two "count") keeps each occurrence apart.
function columnKeys(columns: string[]): string[] {
  const seen = new Map<string, number>();
  return columns.map((column) => {
    const name = column.trim().toLowerCase();
    const occurrence = seen.get(name) ?? 0;
    seen.set(name, occurrence + 1);
    return `${name}#${occurrence}`;
  });
}

// When two or more connections answered, all their rows go into one table:
// a leading "Connection" column saying which database each row came from,
// then every column any of them returned (first-seen order). A cell a
// database didn't return is null. With fewer than two, null.
export function combineAnswers(answers: ConnectionAnswer[]): CombinedResult | null {
  const answered = answers.filter((a) => !a.error && Array.isArray(a.columns) && Array.isArray(a.rows));
  if (answered.length < 2) {
    return null;
  }

  const headers: string[] = [];
  const positionOf = new Map<string, number>();
  const keysPerAnswer = answered.map((a) => {
    const keys = columnKeys(a.columns!);
    keys.forEach((key, i) => {
      if (!positionOf.has(key)) {
        positionOf.set(key, headers.length);
        headers.push(a.columns![i]!);
      }
    });
    return keys;
  });

  const rows = answered.flatMap((a, answerIndex) => {
    const keys = keysPerAnswer[answerIndex]!;
    return a.rows!.map((row) => {
      const merged: unknown[] = new Array(headers.length).fill(null);
      keys.forEach((key, i) => {
        merged[positionOf.get(key)!] = row[i];
      });
      return [a.dataSourceName, ...merged];
    });
  });

  return {
    columns: [CONNECTION_COLUMN, ...headers],
    rows,
    truncated: answered.some((a) => !!a.truncated),
  };
}
