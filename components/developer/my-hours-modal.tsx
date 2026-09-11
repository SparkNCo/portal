"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
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
import { Calendar, CalendarRange, History, Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
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
const DAYS_SHOWN = 30;
// Upper bound on a custom date range (below) — without this, picking two
// dates years apart would zero-fill a day-point for every single day in
// between, which is both a needless amount of work and an unreadable chart.
const MAX_RANGE_DAYS = 366;
const LINE_COLOR = "oklch(0.75 0.16 55)";

// One line per project when "All Projects" is selected — cycled by index so
// any number of projects still gets a (repeating, eventually) distinct color
// rather than erroring out past a fixed palette size.
const PROJECT_LINE_COLORS = [
  "oklch(0.75 0.16 55)", // orange (same as the single-project line)
  "oklch(0.7 0.18 250)", // blue
  "oklch(0.75 0.15 145)", // green
  "oklch(0.72 0.2 330)", // pink
  "oklch(0.8 0.17 95)", // yellow
  "oklch(0.7 0.15 200)", // teal
  "oklch(0.68 0.22 25)", // red
  "oklch(0.72 0.16 300)", // purple
];

function projectColor(index: number): string {
  return PROJECT_LINE_COLORS[index % PROJECT_LINE_COLORS.length]!;
}

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

// Inclusive day count between two ISO dates — e.g. the same day both ways
// counts as 1 day, not 0.
function daysBetweenInclusive(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000)) + 1;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Default range shown on open — "last 2 weeks" through today, rather than
// starting with no range picked (which used to fall back to a plain
// unfiltered 30-day view with no explicit dates shown anywhere).
function twoWeeksAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toISOString().slice(0, 10);
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
  // Per-project breakdown for that day — only populated/used when "All
  // Projects" is selected, so the chart can plot one Line per project
  // instead of one combined total. Read via a dataKey *function* (see the
  // per-project <Line> below) rather than spread onto the object as flat
  // keys, so this type doesn't need an index signature for arbitrary
  // project names.
  projectHours: Record<string, number>;
};

// Shared by both dailyData and rangeDays below — was duplicated inline in
// each, which had already drifted slightly (only one of the two tracked
// ticketCodes correctly). One definition means both view modes build a
// DayPoint the exact same way, all-projects breakdown included.
function buildDayPoint(
  date: string,
  list: HoursLogEntry[],
  resolveTicketCode: (id: string) => string,
): DayPoint {
  const d = new Date(`${date}T00:00:00`);
  const projectHours: Record<string, number> = {};
  for (const e of list) {
    projectHours[e.project_name] = (projectHours[e.project_name] ?? 0) + e.hours;
  }
  return {
    date,
    label: dayLabel(date),
    weekStart: mondayOf(date),
    monthKey: `${d.getFullYear()}-${d.getMonth()}`,
    monthLabel: d.toLocaleDateString(undefined, { month: "short" }),
    hours: list.reduce((sum, e) => sum + e.hours, 0),
    entries: list,
    ticketCodes: Array.from(new Set(list.flatMap((e) => e.issue_ids))).map(resolveTicketCode),
    projectHours,
  };
}

// Purely visual now — the actual click handling lives on the chart itself
// (see `onClick` on LineChart below), since a real 4px dot is much too small
// a hit target to click reliably. A plain <circle> (rather than recharts'
// built-in Dot) keeps this in sync with the chart's own click handling
// instead of adding a second, redundant, imprecise click target. Skips
// rendering entirely on a zero-hours day — the zero-filled days (see
// buildDayPoint) exist so the line still dips to the floor between real
// entries, but a dot on every single day made it look like something was
// logged even on days with nothing at all.
function ChartDot(props: any) {
  const { cx, cy, fill, value } = props;
  if (cx == null || cy == null) return null;
  if (!value) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={fill ?? LINE_COLOR}
      stroke="oklch(0.13 0 0)"
      strokeWidth={1}
    />
  );
}

function DayTooltip({
  active,
  payload,
  isMultiProject,
}: {
  active?: boolean;
  payload?: any[];
  isMultiProject?: boolean;
}) {
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
      <div className="font-medium">{formatDate(point.date)}{!isMultiProject && ` · ${point.hours}h`}</div>
      {isMultiProject && (
        <ul className="mt-1 space-y-0.5">
          {payload
            .filter((p) => (p.value ?? 0) > 0)
            .map((p) => (
              <li key={p.name} style={{ color: p.color }}>
                {p.name}: {p.value}h
              </li>
            ))}
          {payload.every((p) => (p.value ?? 0) === 0) && (
            <li style={{ color: "oklch(0.6 0 0)" }}>No hours logged</li>
          )}
        </ul>
      )}
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
  const [dateFrom, setDateFrom] = useState(twoWeeksAgoIso);
  const [dateTo, setDateTo] = useState(todayIso);
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
    return Array.from(buckets, ([date, list]) => buildDayPoint(date, list, resolveTicketCode))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-DAYS_SHOWN);
  }, [filteredEntries, issueById]);

  // Which projects to draw a separate line for — only when "All Projects" is
  // selected (a single-project filter already shows just that one project's
  // combined line, no breakdown needed), and only projects that actually
  // have at least one hour logged rather than every project the developer is
  // assigned to.
  const activeProjectNames = useMemo(() => {
    if (projectFilter !== ALL_PROJECTS) return [];
    return Array.from(new Set(filteredEntries.map((e) => e.project_name))).sort();
  }, [filteredEntries, projectFilter]);
  const isMultiProject = activeProjectNames.length > 0;

  const weeklyAllocation = useMemo(() => {
    if (projectFilter === ALL_PROJECTS) {
      return projects.reduce((sum, p) => sum + (p.allocation ?? 0), 0);
    }
    return projects.find((p) => p.clientName === projectFilter)?.allocation ?? 0;
  }, [projects, projectFilter]);

  const isRangeSelected = !!dateFrom && !!dateTo;
  const isRangeInvalid = isRangeSelected && dateFrom > dateTo;
  const isRangeTooLong =
    isRangeSelected && !isRangeInvalid && daysBetweenInclusive(dateFrom, dateTo) > MAX_RANGE_DAYS;
  const isRangeFocused = isRangeSelected && !isRangeInvalid && !isRangeTooLong;

  // A zero-filled day-by-day span between the two picked dates (inclusive)
  // — same idea the old single-week view used, just for an arbitrary range.
  // Built straight from `filteredEntries` (not `dailyData`, which is capped
  // to the last 30 days) so a range reaching further back still shows its
  // real entries instead of nothing.
  const rangeDays = useMemo<DayPoint[]>(() => {
    if (!isRangeFocused) return [];
    const dayCount = daysBetweenInclusive(dateFrom, dateTo);
    const byDate = new Map<string, HoursLogEntry[]>();
    for (const e of filteredEntries) {
      if (e.worked_on < dateFrom || e.worked_on > dateTo) continue;
      const list = byDate.get(e.worked_on) ?? [];
      list.push(e);
      byDate.set(e.worked_on, list);
    }
    return Array.from({ length: dayCount }, (_, i) => {
      const date = addDays(dateFrom, i);
      return buildDayPoint(date, byDate.get(date) ?? [], resolveTicketCode);
    });
  }, [isRangeFocused, dateFrom, dateTo, filteredEntries]);

  const rangeTotal = rangeDays.reduce((sum, d) => sum + d.hours, 0);
  // Prorates the weekly allocation to the size of the picked range (e.g. a
  // 14-day range against a 20h/week allocation reads as "40h allocated"),
  // rather than always comparing against one week's worth regardless of
  // how many days are actually selected.
  const rangeAllocation = (weeklyAllocation * rangeDays.length) / 7;

  const chartData = isRangeFocused ? rangeDays : dailyData;

  // First day of each month present — marked with a labeled divider.
  const monthBoundaries = useMemo(() => {
    const seen = new Set<string>();
    return chartData.filter((d) => {
      if (seen.has(d.monthKey)) return false;
      seen.add(d.monthKey);
      return true;
    });
  }, [chartData]);

  // First day of each week present — a lighter, unlabeled divider so the
  // daily points still read as grouped into weeks.
  const weekBoundaries = useMemo(() => {
    const seen = new Set<string>();
    return chartData.filter((d) => {
      if (seen.has(d.weekStart)) return false;
      seen.add(d.weekStart);
      return true;
    });
  }, [chartData]);

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
              : "sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
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
                <div className="space-y-2">
                  <Select
                    value={projectFilter}
                    onValueChange={(v) => {
                      setProjectFilter(v);
                      setSelectedDay(null);
                    }}
                  >
                    <SelectTrigger className="smalltext bg-secondary border-0 w-full">
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

                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1 min-w-0">
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                          setDateFrom(e.target.value);
                          setSelectedDay(null);
                        }}
                        className="smalltext bg-secondary border-0 pr-8 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0"
                        aria-label="Start date"
                      />
                      <Calendar className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" />
                    </div>
                    <span className="smalltext text-muted-foreground shrink-0">to</span>
                    <div className="relative flex-1 min-w-0">
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value);
                          setSelectedDay(null);
                        }}
                        className="smalltext bg-secondary border-0 pr-8 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0"
                        aria-label="End date"
                      />
                      <Calendar className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" />
                    </div>
                    {(dateFrom || dateTo) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setDateFrom("");
                          setDateTo("");
                          setSelectedDay(null);
                        }}
                        aria-label="Clear date range"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {isRangeInvalid && (
                  <p className="smalltext text-destructive">
                    End date must be on or after the start date.
                  </p>
                )}
                {isRangeTooLong && (
                  <p className="smalltext text-destructive">
                    Pick a range of {MAX_RANGE_DAYS} days or fewer.
                  </p>
                )}

                {chartData.length === 0 ? (
                  // Same Card, same min-height as the chart below — otherwise
                  // the modal visibly shrinks/jumps every time a project or
                  // date range with no data is picked.
                  <Card className="bg-background border-border">
                    <CardContent className="flex min-h-[300px] items-center justify-center py-6">
                      <p className="smalltext text-muted-foreground text-center">
                        No hours logged for this project.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-background border-border">
                    <CardHeader>
                      <CardTitle className="smalltext font-semibold flex items-center gap-2">
                        <CalendarRange className="h-4 w-4 text-primary" />
                        {isRangeFocused ? `${formatDate(dateFrom)} – ${formatDate(dateTo)}` : "Hours Over Time"}
                        {!isRangeFocused && weeklyAllocation > 0 && (
                          <span className="ml-auto smalltext font-normal text-muted-foreground">
                            Allocation: {weeklyAllocation}h/wk
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {isRangeFocused && <AllocationMeter hours={rangeTotal} allocation={rangeAllocation} />}
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
                              interval={isRangeFocused && chartData.length <= 14 ? 0 : "preserveStartEnd"}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: "oklch(0.6 0 0)" }}
                              axisLine={false}
                              tickLine={false}
                              width={30}
                              allowDecimals={false}
                            />
                            <Tooltip content={<DayTooltip isMultiProject={isMultiProject} />} />
                            {isMultiProject && (
                              <Legend
                                wrapperStyle={{ fontSize: 11 }}
                                formatter={(value) => (
                                  <span style={{ color: "oklch(0.75 0 0)" }}>{value}</span>
                                )}
                              />
                            )}
                            {weekBoundaries.map((d) => (
                              <ReferenceLine
                                key={`week-${d.weekStart}`}
                                x={d.label}
                                stroke="oklch(0.3 0 0)"
                              />
                            ))}
                            {monthBoundaries.map((d) => (
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
                            {isMultiProject ? (
                              activeProjectNames.map((name, i) => {
                                const color = projectColor(i);
                                return (
                                  <Line
                                    key={name}
                                    type="monotone"
                                    name={name}
                                    dataKey={(d: DayPoint) => d.projectHours[name] ?? 0}
                                    stroke={color}
                                    strokeWidth={2}
                                    dot={<ChartDot fill={color} />}
                                    activeDot={{ r: 6, fill: color, stroke: "oklch(0.13 0 0)", strokeWidth: 1 }}
                                  />
                                );
                              })
                            ) : (
                              <Line
                                type="monotone"
                                dataKey="hours"
                                stroke={LINE_COLOR}
                                strokeWidth={2}
                                dot={<ChartDot />}
                                activeDot={{ r: 6, fill: LINE_COLOR, stroke: "oklch(0.13 0 0)", strokeWidth: 1 }}
                              />
                            )}
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
