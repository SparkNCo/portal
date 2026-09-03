"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { CalendarRange, History, Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingDataPanel } from "@/components/loader";
import { ExpandableDialogChrome } from "@/components/shared/expandable-dialog-chrome";
import { fetchHours, type HoursLogEntry } from "@/lib/hours-api";
import { cn, getIssueCode } from "@/lib/utils";
import { LogHoursModal } from "@/components/developer/log-hours-modal";

type Project = { clientName: string; slug: string; allocation?: number | null };

const ALL_PROJECTS = "__all__";
const ALL_WEEKS = "__all_weeks__";
const DAYS_SHOWN = 30;
const LINE_COLOR = "oklch(0.75 0.16 55)";

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Monday of the week `iso` falls in, as a YYYY-MM-DD string — used to mark
// where each week starts on the (daily) chart.
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekRangeLabel(monday: string) {
  const start = new Date(`${monday}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// "A single ratio against a limit" — a meter, not a line/bar chart: the fill
// carries how much of the week's allocation has been used, the track is a
// lighter step of the same hue so the whole bar still reads at a glance.
function AllocationMeter({ hours, allocation }: { readonly hours: number; readonly allocation: number }) {
  if (allocation <= 0) return null;
  const pct = Math.min(100, Math.round((hours / allocation) * 100));
  const over = hours > allocation;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between smalltext">
        <span className="font-medium text-foreground">{hours}h logged</span>
        <span className="text-muted-foreground">of {allocation}h allocated ({pct}%)</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-primary/15 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", over ? "bg-success" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over && (
        <p className="smalltext text-success">
          {Math.round((hours - allocation) * 10) / 10}h over allocation
        </p>
      )}
    </div>
  );
}

type DayPoint = {
  date: string;
  label: string;
  weekStart: string;
  monthKey: string;
  monthLabel: string;
  hours: number;
  entries: HoursLogEntry[];
  ticketCodes: string[];
};

// Purely visual now — the actual click handling lives on the chart itself
// (see `onClick` on LineChart below), since a real 4px dot is much too small
// a hit target to click reliably. A plain <circle> (rather than recharts'
// built-in Dot) keeps this in sync with the chart's own click handling
// instead of adding a second, redundant, imprecise click target.
function ChartDot(props: any) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={LINE_COLOR}
      stroke="oklch(0.13 0 0)"
      strokeWidth={1}
    />
  );
}

function DayTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as DayPoint | undefined;
  if (!point) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 smalltext"
      style={{
        backgroundColor: "oklch(0.13 0 0)",
        borderColor: "oklch(0.22 0 0)",
        color: "oklch(0.95 0 0)",
      }}
    >
      <div className="font-medium">{formatDate(point.date)} · {point.hours}h</div>
      {point.ticketCodes.length > 0 ? (
        <ul className="mt-1 space-y-0.5" style={{ color: "oklch(0.75 0 0)" }}>
          {point.ticketCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1" style={{ color: "oklch(0.6 0 0)" }}>No tickets logged</p>
      )}
      <p className="mt-1.5" style={{ color: "oklch(0.55 0 0)" }}>Click point for details</p>
    </div>
  );
}

export function MyHoursModal({
  projects,
  issues,
  developerId,
  developerEmail,
  onClose,
}: {
  readonly projects: Project[];
  readonly issues: any[];
  readonly developerId: string;
  readonly developerEmail: string;
  readonly onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HoursLogEntry | null>(null);
  const [projectFilter, setProjectFilter] = useState(ALL_PROJECTS);
  const [weekFilter, setWeekFilter] = useState(ALL_WEEKS);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["hours-logged", developerId],
    queryFn: () => fetchHours(developerId),
    enabled: !!developerId,
  });

  const issueById = useMemo(
    () => new Map(issues.map((i: any) => [i.id, i])),
    [issues],
  );

  function resolveTicketCode(id: string): string {
    const issue = issueById.get(id);
    if (!issue) return id;
    return issue.branchName ? getIssueCode(issue.branchName) : issue.title;
  }

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    return projectFilter === ALL_PROJECTS
      ? entries
      : entries.filter((e) => e.project_name === projectFilter);
  }, [entries, projectFilter]);

  const dailyData = useMemo<DayPoint[]>(() => {
    const buckets = new Map<string, HoursLogEntry[]>();
    for (const e of filteredEntries) {
      const list = buckets.get(e.worked_on) ?? [];
      list.push(e);
      buckets.set(e.worked_on, list);
    }
    return Array.from(buckets, ([date, list]) => {
      const d = new Date(`${date}T00:00:00`);
      return {
        date,
        label: dayLabel(date),
        weekStart: mondayOf(date),
        monthKey: `${d.getFullYear()}-${d.getMonth()}`,
        monthLabel: d.toLocaleDateString(undefined, { month: "short" }),
        hours: list.reduce((sum, e) => sum + e.hours, 0),
        entries: list,
        ticketCodes: Array.from(new Set(list.flatMap((e) => e.issue_ids))).map(resolveTicketCode),
      };
    })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-DAYS_SHOWN);
  }, [filteredEntries, issueById]);

  // First day of each month present — marked with a labeled divider.
  const monthBoundaries = useMemo(() => {
    const seen = new Set<string>();
    return dailyData.filter((d) => {
      if (seen.has(d.monthKey)) return false;
      seen.add(d.monthKey);
      return true;
    });
  }, [dailyData]);

  // First logged day of each week present — a lighter, unlabeled divider so
  // the daily points still read as grouped into weeks.
  const weekBoundaries = useMemo(() => {
    const seen = new Set<string>();
    return dailyData.filter((d) => {
      if (seen.has(d.weekStart)) return false;
      seen.add(d.weekStart);
      return true;
    });
  }, [dailyData]);

  const weeklyAllocation = useMemo(() => {
    if (projectFilter === ALL_PROJECTS) {
      return projects.reduce((sum, p) => sum + (p.allocation ?? 0), 0);
    }
    return projects.find((p) => p.clientName === projectFilter)?.allocation ?? 0;
  }, [projects, projectFilter]);

  // Every week that has at least one entry (not capped to the last 30 days
  // like `dailyData` — the picker should still reach further back), most
  // recent first, for the "focus on one week" selector.
  const availableWeeks = useMemo(() => {
    const seen = new Set<string>();
    const weeks: string[] = [];
    for (const e of filteredEntries) {
      const monday = mondayOf(e.worked_on);
      if (!seen.has(monday)) {
        seen.add(monday);
        weeks.push(monday);
      }
    }
    return weeks.sort((a, b) => b.localeCompare(a));
  }, [filteredEntries]);

  // The focused week's full Mon-Sun span, zero-filled for days with nothing
  // logged — built straight from `filteredEntries` rather than `dailyData`,
  // which is capped to the last 30 days and would silently drop an older
  // week's real entries as if nothing was logged those days.
  const focusedWeekDays = useMemo<DayPoint[]>(() => {
    if (weekFilter === ALL_WEEKS) return [];
    const byDate = new Map<string, HoursLogEntry[]>();
    for (const e of filteredEntries) {
      if (mondayOf(e.worked_on) !== weekFilter) continue;
      const list = byDate.get(e.worked_on) ?? [];
      list.push(e);
      byDate.set(e.worked_on, list);
    }
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekFilter, i);
      const list = byDate.get(date) ?? [];
      const d = new Date(`${date}T00:00:00`);
      return {
        date,
        label: dayLabel(date),
        weekStart: weekFilter,
        monthKey: `${d.getFullYear()}-${d.getMonth()}`,
        monthLabel: d.toLocaleDateString(undefined, { month: "short" }),
        hours: list.reduce((sum, e) => sum + e.hours, 0),
        entries: list,
        ticketCodes: Array.from(new Set(list.flatMap((e) => e.issue_ids))).map(resolveTicketCode),
      };
    });
  }, [weekFilter, filteredEntries]);

  const focusedWeekTotal = focusedWeekDays.reduce((sum, d) => sum + d.hours, 0);
  const isWeekFocused = weekFilter !== ALL_WEEKS;
  const chartData = isWeekFocused ? focusedWeekDays : dailyData;

  const selectedDayData = chartData.find((d) => d.date === selectedDay) ?? null;

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["hours-logged", developerId] });
  }

  return (
    <>
      <Dialog open={!editingEntry} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className={`w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto overflow-x-hidden transition-all duration-200 ${
            isExpanded
              ? "sm:max-w-2xl md:max-w-4xl lg:max-w-5xl"
              : "sm:max-w-lg md:max-w-xl lg:max-w-2xl"
          }`}
          aria-describedby={undefined}
        >
          <ExpandableDialogChrome
            isExpanded={isExpanded}
            onToggleExpanded={() => setIsExpanded((e) => !e)}
          />

          <DialogHeader className="pt-4">
            <DialogTitle className="body flex items-center gap-2 text-primary">
              <History className="h-4 w-4" />
              My Logged Hours
            </DialogTitle>
          </DialogHeader>

          <div className="pt-2 space-y-4">
            {isLoading ? (
              <LoadingDataPanel />
            ) : !entries || entries.length === 0 ? (
              <p className="smalltext text-muted-foreground py-6 text-center">
                No hours logged yet.
              </p>
            ) : (
              <>
                <div className="flex gap-2">
                  <Select
                    value={projectFilter}
                    onValueChange={(v) => {
                      setProjectFilter(v);
                      setWeekFilter(ALL_WEEKS);
                      setSelectedDay(null);
                    }}
                  >
                    <SelectTrigger className="smalltext bg-secondary border-0 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_PROJECTS} className="smalltext">
                        All Projects
                      </SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.clientName} value={p.clientName} className="smalltext">
                          {p.clientName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {availableWeeks.length > 0 && (
                    <Select
                      value={weekFilter}
                      onValueChange={(v) => {
                        setWeekFilter(v);
                        setSelectedDay(null);
                      }}
                    >
                      <SelectTrigger className="smalltext bg-secondary border-0 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_WEEKS} className="smalltext">
                          All Weeks
                        </SelectItem>
                        {availableWeeks.map((monday) => (
                          <SelectItem key={monday} value={monday} className="smalltext">
                            Week of {weekRangeLabel(monday)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {chartData.length === 0 ? (
                  <p className="smalltext text-muted-foreground py-6 text-center">
                    No hours logged for this project.
                  </p>
                ) : (
                  <Card className="bg-background border-border">
                    <CardHeader>
                      <CardTitle className="smalltext font-semibold flex items-center gap-2">
                        <CalendarRange className="h-4 w-4 text-primary" />
                        {isWeekFocused ? `Week of ${weekRangeLabel(weekFilter)}` : "Hours Over Time"}
                        {!isWeekFocused && weeklyAllocation > 0 && (
                          <span className="ml-auto smalltext font-normal text-muted-foreground">
                            Allocation: {weeklyAllocation}h/wk
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {isWeekFocused && <AllocationMeter hours={focusedWeekTotal} allocation={weeklyAllocation} />}
                      <div className="h-56 cursor-pointer [&_*:focus]:outline-none [&_*:focus-visible]:outline-none">
                        <ResponsiveContainer width="100%" height={224}>
                          <LineChart
                            data={chartData}
                            margin={{ top: 18 }}
                            onClick={(state) => {
                              const label = state?.activeLabel;
                              if (label == null) return;
                              const point = chartData.find((d) => d.label === label);
                              if (point) setSelectedDay(point.date);
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0 0)" />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 11, fill: "oklch(0.6 0 0)" }}
                              axisLine={false}
                              tickLine={false}
                              interval={isWeekFocused ? 0 : "preserveStartEnd"}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: "oklch(0.6 0 0)" }}
                              axisLine={false}
                              tickLine={false}
                              width={30}
                              allowDecimals={false}
                            />
                            <Tooltip content={<DayTooltip />} />
                            {!isWeekFocused && weekBoundaries.map((d) => (
                              <ReferenceLine
                                key={`week-${d.weekStart}`}
                                x={d.label}
                                stroke="oklch(0.3 0 0)"
                              />
                            ))}
                            {!isWeekFocused && monthBoundaries.map((d) => (
                              <ReferenceLine
                                key={`month-${d.monthKey}`}
                                x={d.label}
                                stroke="oklch(0.4 0 0)"
                                strokeDasharray="2 2"
                                label={{
                                  value: d.monthLabel,
                                  position: "top",
                                  fill: "oklch(0.6 0 0)",
                                  fontSize: 11,
                                }}
                              />
                            ))}
                            <Line
                              type="monotone"
                              dataKey="hours"
                              stroke={LINE_COLOR}
                              strokeWidth={2}
                              dot={<ChartDot />}
                              activeDot={{ r: 6, fill: LINE_COLOR, stroke: "oklch(0.13 0 0)", strokeWidth: 1 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedDayData && (
                  <Card className="bg-black border-border">
                    <CardHeader>
                      <CardTitle className="smalltext font-semibold flex items-center justify-between">
                        <span className="text-primary">
                          Details — {formatDate(selectedDayData.date)} ({selectedDayData.hours}h)
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedDay(null)}
                          aria-label="Close details"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedDayData.entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-md border border-primary bg-background/60 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="smalltext font-medium text-foreground">
                                {formatDate(entry.worked_on)}
                              </span>
                              <Badge variant="outline" className="smalltext">
                                {entry.hours}h
                              </Badge>
                              <span className="smalltext text-muted-foreground">
                                {entry.project_name}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 shrink-0 border-primary text-primary hover:bg-primary/10 hover:text-primary"
                              onClick={() => setEditingEntry(entry)}
                              aria-label="Edit this entry"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {entry.issue_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {entry.issue_ids.map((id) => (
                                <Badge key={id} variant="secondary" className="smalltext">
                                  {resolveTicketCode(id)}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {entry.summary && (
                            <div className="smalltext text-foreground prose prose-sm prose-invert max-w-none [&_p]:my-1">
                              <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                                {entry.summary}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {editingEntry && (
        <LogHoursModal
          projects={projects}
          issues={issues}
          developerId={developerId}
          developerEmail={developerEmail}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onChanged={refetch}
        />
      )}
    </>
  );
}
