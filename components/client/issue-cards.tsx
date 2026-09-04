"use client";

import { Badge } from "@/components/ui/badge";
import {
  Gauge,
  Bug,
  Lightbulb,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { cn, getIssueCode } from "@/lib/utils";
import { type Issue, priorityColors, statusColors } from "./issues.types";

function EstimateBadge({ estimate }: { readonly estimate: number }) {
  return (
    <Badge
      variant="outline"
      className="gap-1 smalltext border-chart-1/30 bg-chart-1/10 text-chart-1"
    >
      <Gauge className="h-3 w-3" />
      {estimate}
    </Badge>
  );
}

// statusColors (issues.types.ts) gives these three a flat bg-muted/text-muted-foreground
// pairing that assumes the app's dark background — it blends into a light-card surface
// (see the `lightCard`-gated branches below), so those get a theme-aware outline badge
// instead of the flat statusColors classes.
export const NEUTRAL_STATUS_NAMES = new Set(["Backlog", "Not Started", "waiting"]);

const LABEL_COLOR_CLASSES: Record<string, string> = {
  bug: "bg-destructive text-white",
  improvement: "bg-[hsl(210,70%,35%)] text-white",
  feature: "bg-success text-white",
};

export const LABEL_ICONS: Record<
  string,
  { Icon: LucideIcon; className: string }
> = {
  bug: { Icon: Bug, className: "text-destructive" },
  feature: { Icon: Lightbulb, className: "text-success" },
};

export function LabelPill({
  label,
  iconOnly = false,
}: {
  readonly label: { id: string; name: string; color: string };
  readonly iconOnly?: boolean;
}) {
  const key = label.name.toLowerCase();

  if (iconOnly) {
    if (!LABEL_ICONS[key]) return null;
    const { Icon, className } = LABEL_ICONS[key];
    return (
      <span title={label.name} aria-label={label.name} className="shrink-0">
        <Icon className={`h-3.5 w-3.5 ${className}`} aria-hidden="true" />
      </span>
    );
  }

  const knownClass = LABEL_COLOR_CLASSES[key];

  if (knownClass) {
    return (
      <Badge
        variant="secondary"
        className={`smalltext border-transparent ${knownClass}`}
      >
        {label.name}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="smalltext border-transparent text-white"
      style={{ backgroundColor: "#8D1111" }}
    >
      {label.name}
    </Badge>
  );
}

// Left-edge accent stripe so priority reads at a glance without having to
// parse the badge text — same hue family as `priorityColors` above, just the
// solid fill instead of the translucent badge treatment.
const PRIORITY_STRIPE_COLORS: Record<Issue["priorityLabel"], string> = {
  Urgent: "bg-destructive",
  High: "bg-chart-1",
  Medium: "bg-primary",
  Low: "bg-chart-5",
  "No priority": "bg-muted-foreground/25",
};

// Text-only counterpart, for the priority label once it's just a plain word
// next to the stripe rather than its own filled badge.
const PRIORITY_TEXT_COLORS: Record<Issue["priorityLabel"], string> = {
  Urgent: "text-destructive",
  High: "text-chart-1",
  Medium: "text-primary",
  Low: "text-chart-5",
  "No priority": "text-muted-foreground",
};

export function IssueCard({
  issue,
  onOpen,
  hasUpdate,
  lightCard = false,
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
  readonly hasUpdate?: boolean;
  readonly lightCard?: boolean;
}) {
  const typeLabel = issue.labels?.nodes?.find(
    (l) => LABEL_ICONS[l.name.toLowerCase()],
  );
  const typeIcon = typeLabel
    ? LABEL_ICONS[typeLabel.name.toLowerCase()]
    : undefined;
  const otherLabels = issue.labels?.nodes?.filter(
    (l) => l.id !== typeLabel?.id,
  );

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-border hover:shadow-md hover:-translate-y-px transition-all duration-150",
        lightCard
          ? "light-card"
          : "bg-background hover:bg-muted text-foreground",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1 rounded-l-lg",
          PRIORITY_STRIPE_COLORS[issue.priorityLabel],
        )}
        aria-hidden="true"
      />
      <button
        type="button"
        className="absolute inset-0 rounded-lg cursor-pointer"
        onClick={onOpen}
        aria-label={issue.title}
      />
      {hasUpdate && (
        <span
          className="absolute top-2 right-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 ring-2 ring-background"
          title="Recently updated"
        >
          <Mail className="h-2.5 w-2.5 text-white" />
        </span>
      )}
      <div className="p-4 pl-5">
        <div className="flex items-center gap-1.5 mb-2">
          {typeIcon && (
            <typeIcon.Icon
              className={`h-3.5 w-3.5 shrink-0 ${typeIcon.className}`}
              aria-label={typeLabel!.name}
            />
          )}
          <span
            className={cn(
              "smalltext font-mono shrink-0",
              lightCard ? "light-card-muted" : "text-muted-foreground",
            )}
          >
            {getIssueCode(issue.branchName)}
          </span>
          {issue._project && (
            <span
              className={cn(
                "smalltext truncate",
                lightCard ? "light-card-muted" : "text-muted-foreground/70",
              )}
              title={issue._project}
            >
              · {issue._project}
            </span>
          )}
          <span
            className={cn(
              "smalltext ml-auto shrink-0 font-semibold",
              PRIORITY_TEXT_COLORS[issue.priorityLabel],
            )}
          >
            {issue.priorityLabel}
          </span>
        </div>
        <p
          className={cn(
            "text-sm font-semibold leading-snug mb-2.5 line-clamp-2",
            lightCard ? "light-card-text" : "text-foreground",
          )}
        >
          {issue.title}
        </p>
        <div className="flex items-center gap-1 flex-wrap">
          {issue?.state?.name &&
            (lightCard && NEUTRAL_STATUS_NAMES.has(issue.state.name) ? (
              <Badge variant="outline" className="smalltext border light-card-text">
                {issue.state.name}
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className={`smalltext ${
                  statusColors[issue.state.name as keyof typeof statusColors]
                }`}
              >
                {issue.state.name}
              </Badge>
            ))}
          {issue.estimate != null && (
            <EstimateBadge estimate={issue.estimate} />
          )}
          {otherLabels?.map((l) => (
            <LabelPill key={l.id} label={l} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function IssueListRow({
  issue,
  onOpen,
  hasUpdate,
  lightCard = false,
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
  readonly hasUpdate?: boolean;
  readonly lightCard?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-1.5 px-3 py-2.5 rounded-lg transition-all border border-transparent hover:border-border",
        lightCard
          ? "light-card"
          : "bg-background hover:bg-muted text-foreground",
      )}
    >
      <button
        type="button"
        className="absolute inset-0 rounded-lg cursor-pointer "
        onClick={onOpen}
        aria-label={issue.title}
      />
      <span
        className={cn(
          "smalltext font-mono flex-shrink-0 whitespace-nowrap",
          lightCard ? "light-card-muted" : "text-muted-foreground",
        )}
      >
        {getIssueCode(issue.branchName)}
      </span>
      <Badge
        variant="outline"
        className={`smalltext flex-shrink-0 w-24 justify-center px-1 whitespace-nowrap mr-2 ${priorityColors[issue.priorityLabel]}`}
      >
        {issue.priorityLabel}
      </Badge>

      <p
        className={cn(
          "smalltext font-medium  flex-1 truncate",
          lightCard ? "light-card-text" : "text-foreground",
        )}
      >
        {issue.title}
      </p>
      {hasUpdate && (
        <span
          className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-orange-500"
          title="Recently updated"
        >
          <Mail className="h-2 w-2 text-white" />
        </span>
      )}
      {issue.state?.name &&
        (lightCard && NEUTRAL_STATUS_NAMES.has(issue.state.name) ? (
          <Badge
            variant="outline"
            className="smalltext flex-shrink-0 whitespace-nowrap border light-card-text"
          >
            {issue.state.name}
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className={`smalltext flex-shrink-0 whitespace-nowrap ${
              statusColors[issue.state.name as keyof typeof statusColors]
            }`}
          >
            {issue.state.name}
          </Badge>
        ))}
      {issue.labels?.nodes?.map((l) => (
        <LabelPill key={l.id} label={l} iconOnly />
      ))}
    </div>
  );
}
