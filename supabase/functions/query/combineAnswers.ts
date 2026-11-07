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

// How the merged rows are sorted and cut (planned once from the question —
// see planResult in prompt.ts).
export type CombineOrder = {
  orderBy: string | null;
  descending: boolean;
  limit: number | null;
};

// JSON / array cells compare by their JSON text, not "[object Object]".
function cellText(value: unknown): string {
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// Numbers, and numbers as text (Postgres sends numeric/bigint as strings),
// compare as numbers; the rest as text. Empty cells always go last.
function compareCells(a: unknown, b: unknown, descending: boolean): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty || bEmpty) {
    return Number(aEmpty) - Number(bEmpty);
  }
  const aNumber = typeof a === "number" ? a : Number(a);
  const bNumber = typeof b === "number" ? b : Number(b);
  const order = Number.isFinite(aNumber) && Number.isFinite(bNumber)
    ? aNumber - bNumber
    : cellText(a).localeCompare(cellText(b), undefined, { numeric: true });
  return descending ? -order : order;
}

function sortAndCut(columns: string[], rows: unknown[][], order?: CombineOrder): unknown[][] {
  if (!order) {
    return rows;
  }
  let result = rows;
  const sortName = order.orderBy?.trim().toLowerCase();
  const index = sortName ? columns.findIndex((c) => c.trim().toLowerCase() === sortName) : -1;
  if (index >= 0) {
    // Array sort is stable: ties keep their connection order.
    result = [...rows].sort((a, b) => compareCells(a[index], b[index], order.descending));
  }
  if (order.limit) {
    result = result.slice(0, order.limit);
  }
  return result;
}

// When two or more connections answered, all their rows go into one table:
// a leading "Connection" column saying which database each row came from,
// then every column any of them returned (first-seen order). A cell a
// database didn't return is null. With `order`, the rows are sorted across
// connections and cut to its limit (so "top 10" is 10 rows in total, not 10
// per database). With fewer than two, null.
export function combineAnswers(answers: ConnectionAnswer[], order?: CombineOrder): CombinedResult | null {
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

  const columns = [CONNECTION_COLUMN, ...headers];
  return {
    columns,
    rows: sortAndCut(columns, rows, order),
    truncated: answered.some((a) => !!a.truncated),
  };
}
