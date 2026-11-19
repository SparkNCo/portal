// Which ticket a chat belongs to, when it's a ticket's chat. No imports, so
// the unit tests load it directly (tests/unit/chat-ticket.spec.ts).

const UUID_UNDERSCORED = /^[0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{12}$/;

// A CometChat ticket group's id is `issue_` + the ticket id with anything
// that isn't a letter or digit turned into "_" (getOrCreateIssueGroup.ts).
// For a Linear ticket (a UUID) that's reversible; anything else (a Jira id,
// whose key can't be told apart from the underscores) isn't, and gives null.
// Groups created since the ticket link carry the id in their metadata, which
// wins over this.
export function issueIdFromGroupGuid(guid: string | null | undefined): string | null {
  const match = /^issue_(.+)$/.exec(guid ?? "");
  if (!match) return null;
  const rest = match[1]!;
  return UUID_UNDERSCORED.test(rest) ? rest.replaceAll("_", "-") : null;
}
