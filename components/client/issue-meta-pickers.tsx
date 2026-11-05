"use client";

import { InlineSelect } from "@/components/shared/inline-select";
import {
  ALL_STATUS_OPTIONS,
  PRIORITY_MENU_OPTIONS,
  priorityColors,
  statusColors,
  type Issue,
} from "./issues.types";

// The priority/status badges in the ticket modal headers (IssueDetailModal,
// EditIssueModal). Each saves straight to the ticket on pick.

export function IssuePriorityPicker({
  currentLabel,
  saving,
  onChange,
}: {
  readonly currentLabel: string;
  readonly saving: boolean;
  readonly onChange: (value: string, label: Issue["priorityLabel"]) => void;
}) {
  return (
    <InlineSelect
      label={currentLabel}
      value={PRIORITY_MENU_OPTIONS.find((o) => o.label === currentLabel)?.value}
      options={PRIORITY_MENU_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
        activeClassName: priorityColors[o.label as keyof typeof priorityColors],
      }))}
      onSelect={(value) => {
        const opt = PRIORITY_MENU_OPTIONS.find((o) => o.value === value);
        if (opt) {
          onChange(opt.value, opt.label);
        }
      }}
      saving={saving}
      badgeClassName={priorityColors[currentLabel as keyof typeof priorityColors]}
      contentClassName="w-44"
    />
  );
}

export function IssueStatusPicker({
  currentState,
  saving,
  onChange,
}: {
  readonly currentState: string | undefined;
  readonly saving: boolean;
  readonly onChange: (state: string) => void;
}) {
  return (
    <InlineSelect
      label={currentState}
      value={currentState}
      options={ALL_STATUS_OPTIONS.map((s) => ({
        value: s,
        label: s,
        activeClassName: statusColors[s as keyof typeof statusColors],
      }))}
      onSelect={onChange}
      saving={saving}
      badgeVariant="secondary"
      badgeClassName={statusColors[currentState as keyof typeof statusColors]}
    />
  );
}
