"use client";

import { Badge } from "@/components/ui/badge";
import {
  Gauge,
  Bug,
  Lightbulb,
  Mail,
  Pencil,
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
  onEdit,
  dueDate,
  completedAt,
  hasUpdate,
  lightCard = false,
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
  // Roadmap's cards need a quick-edit shortcut Bugs doesn't — omitted (no
  // button rendered) wherever the caller doesn't pass it.
  readonly onEdit?: () => void;
  readonly dueDate?: string | null;
  readonly completedAt?: string | null;
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
        "group relative min-h-36 rounded-lg border border-border hover:shadow-md hover:-translate-y-px transition-all duration-150",
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
      {onEdit && (
        <button
          type="button"
          className={cn(
            "absolute top-2 z-10 p-1.5 rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity",
            hasUpdate ? "right-8" : "right-2",
            lightCard ? "light-card-chip" : "hover:bg-secondary",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label="Edit ticket"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
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
        {(dueDate || completedAt) && (
          <div className="mt-1.5 space-y-0.5">
            {dueDate && (
              <p className={cn("smalltext", lightCard ? "light-card-muted" : "text-muted-foreground")}>
                Due: <span className={lightCard ? "light-card-text" : "text-foreground"}>{new Date(dueDate).toLocaleDateString()}</span>
              </p>
            )}
            {completedAt && (
              <p className={cn("smalltext", lightCard ? "light-card-muted" : "text-muted-foreground")}>
                Completed: <span className="text-success">{new Date(completedAt).toLocaleDateString()}</span>
              </p>
            )}
          </div>
        )}
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
        "group relative flex flex-wrap items-center gap-1.5 px-3 py-2.5 rounded-lg transition-all border border-transparent hover:border-border sm:flex-nowrap",
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
      {/* Small screens: the row wraps into two lines — 1) label icon, code,
          title  2) priority, status — since a single squeezed-together line
          left almost no room for the title. `order` re-sequences visually
          without moving anything in the DOM, so sm+ (order-none) falls back
          to plain source order, unchanged. The basis-full spacer below is
          what forces the wrap between the two lines. */}
      <span
        className={cn(
          "order-2 sm:order-none smalltext font-mono flex-shrink-0 whitespace-nowrap",
          lightCard ? "light-card-muted" : "text-muted-foreground",
        )}
      >
        {getIssueCode(issue.branchName)}
      </span>
      <Badge
        variant="outline"
        className={`order-6 sm:order-none smalltext flex-shrink-0 w-24 justify-center px-1 whitespace-nowrap mr-2 ${priorityColors[issue.priorityLabel]}`}
      >
        {issue.priorityLabel}
      </Badge>

      <p
        className={cn(
          "order-3 sm:order-none smalltext font-medium  flex-1 truncate",
          lightCard ? "light-card-text" : "text-foreground",
        )}
      >
        {issue.title}
      </p>
      {hasUpdate && (
        <span
          className="order-4 sm:order-none flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-orange-500"
          title="Recently updated"
        >
          <Mail className="h-2 w-2 text-white" />
        </span>
      )}
      <div className="order-5 basis-full sm:hidden" aria-hidden="true" />
      {issue.state?.name &&
        (lightCard && NEUTRAL_STATUS_NAMES.has(issue.state.name) ? (
          <Badge
            variant="outline"
            className="order-7 sm:order-none smalltext flex-shrink-0 whitespace-nowrap border light-card-text"
          >
            {issue.state.name}
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className={`order-7 sm:order-none smalltext flex-shrink-0 whitespace-nowrap ${
              statusColors[issue.state.name as keyof typeof statusColors]
            }`}
          >
            {issue.state.name}
          </Badge>
        ))}
      <span className="order-1 sm:order-none flex items-center gap-1 flex-shrink-0">
        {issue.labels?.nodes?.map((l) => (
          <LabelPill key={l.id} label={l} iconOnly />
        ))}
      </span>
    </div>
  );
}
