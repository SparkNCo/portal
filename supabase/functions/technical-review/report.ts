// @ts-nocheck
// The report email: the same content as the results page, in the site's look
// (dark band, orange #f78035, cream). Table layout and inline styles only, so
// Gmail and Outlook render it. Everything the person typed is escaped.
import { OFFER_COPY, type Finding, type IdeaGap, type IdeaProfile, type Result } from "./engine/index.ts";

const C = {
  page: "#f4f1ec",
  card: "#ffffff",
  dark: "#111111",
  cream: "#f7f4f0",
  orange: "#f78035",
  text: "#1a1a1a",
  muted: "#6b6b6b",
  line: "#ece7e0",
  soft: "#faf8f5",
};
const FONT = "'Space Grotesk', Arial, Helvetica, sans-serif";
const BODY_FONT = "'Nunito Sans', Arial, Helvetica, sans-serif";

const STATUS = {
  good: { label: "Good", color: "#15803d", bg: "#e7f6ec" },
  gap: { label: "Gap", color: "#c2410c", bg: "#fff1e8" },
  blind_spot: { label: "Blind spot", color: "#a16207", bg: "#fef7d6" },
};
const TONE = { good: "#22c55e", warn: C.orange, neutral: "#c8c2b9" };
const STAGE_COPY = {
  building: "Readiness for launch",
  mvp: "Readiness for your early users",
  scaling: "Readiness for growth",
};

const esc = (s: unknown) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// ── Building blocks ─────────────────────────────────────────────────────────

const table = (inner: string, style = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${style}">${inner}</table>`;

const block = (inner: string, padding = "0 40px 32px") => `<tr><td style="padding:${padding}">${inner}</td></tr>`;

const h2 = (title: string) =>
  `<p style="margin:0 0 14px;font-family:${FONT};font-size:20px;line-height:26px;font-weight:700;color:${C.text}">${esc(title)}</p>`;

const p = (html: string, style = "") =>
  `<p style="margin:0 0 10px;font-family:${BODY_FONT};font-size:15px;line-height:23px;color:${C.text};${style}">${html}</p>`;

const bullets = (items: string[]) =>
  table(
    items
      .map(
        (i) =>
          `<tr><td width="18" valign="top" style="padding:0 0 8px;font-family:${FONT};font-size:15px;line-height:23px;color:${C.orange}">&#9656;</td><td style="padding:0 0 8px;font-family:${BODY_FONT};font-size:15px;line-height:23px;color:${C.text}">${esc(i)}</td></tr>`,
      )
      .join(""),
  );

const pill = (label: string, color: string, bg: string) =>
  `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${bg};color:${color};font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.3px;text-transform:uppercase">${esc(label)}</span>`;

const tag = (label: string) =>
  `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border:1px solid ${C.orange};color:${C.orange};font-family:${FONT};font-size:13px;font-weight:600">${esc(label)}</span>`;

function shell(name: string, eyebrow: string, inner: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<title>Your technical review</title></head>
<body style="margin:0;padding:0;background:${C.page}">
${table(
  `<tr><td align="center" style="padding:32px 12px">
  ${table(
    `
    <tr><td style="background:${C.dark};padding:28px 40px">
      <p style="margin:0;font-family:${FONT};font-size:26px;font-weight:700;letter-spacing:-.5px;color:${C.cream}">spark<span style="color:${C.orange}">/</span>co</p>
      <p style="margin:6px 0 0;font-family:${FONT};font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#bdb6ad">${esc(eyebrow)}</p>
    </td></tr>
    <tr><td style="height:6px;background:${C.orange};font-size:0;line-height:0">&nbsp;</td></tr>
    ${block(
      `${p(`Hi ${esc(name) || "there"},`, "margin-top:4px")}${p("Here's your personalized report. It's yours to keep, whether or not you talk to us.", `color:${C.muted}`)}`,
      "32px 40px 24px",
    )}
    ${inner}
    <tr><td style="padding:24px 40px 32px;border-top:1px solid ${C.line}">
      <p style="margin:0;font-family:${BODY_FONT};font-size:12px;line-height:18px;color:${C.muted}">We don't share your answers with anyone. We use them only to tailor your report and our follow-up.<br>Spark &amp; Co</p>
    </td></tr>`,
    `max-width:600px;background:${C.card}`,
  )}
  </td></tr>`,
  `background:${C.page}`,
)}
</body></html>`;
}

function offerBlock(offer, invite: string, bookingUrl: string) {
  const primary = OFFER_COPY[offer.primary];
  const secondary = offer.secondary.map((id) => OFFER_COPY[id]?.title).filter(Boolean);
  return `<tr><td style="padding:8px 40px 32px">${table(
    `<tr><td style="background:${C.dark};padding:28px">
      <p style="margin:0 0 16px;font-family:${FONT};font-size:19px;line-height:26px;font-weight:600;color:${C.cream}">${esc(invite)}</p>
      <p style="margin:0 0 4px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.orange}">${esc(primary.title)}</p>
      <p style="margin:0 0 20px;font-family:${BODY_FONT};font-size:14px;line-height:21px;color:#d9d3ca">${esc(primary.description)}</p>
      <a href="${esc(bookingUrl)}" style="display:inline-block;background:${C.orange};color:#111111;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none">Book a time &rarr;</a>
      ${secondary.length ? `<p style="margin:16px 0 0;font-family:${BODY_FONT};font-size:13px;color:#bdb6ad">Also available: ${esc(secondary.join(" · "))}</p>` : ""}
    </td></tr>`,
  )}</td></tr>`;
}

function findingCard(f: Finding) {
  return table(
    `<tr><td style="border-left:4px solid ${f.diy ? "#22c55e" : C.orange};background:${C.soft};padding:18px 20px">
      <p style="margin:0 0 8px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.text}">${esc(f.title)}</p>
      ${p(`${esc(f.explanation)} ${esc(f.whyItMatters)}`, "font-size:14px;line-height:21px")}
      <p style="margin:12px 0 6px;font-family:${FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.muted}">Fix prompt &mdash; paste into Cursor, Lovable or Claude</p>
      <div style="background:${C.dark};color:${C.cream};padding:12px 14px;font-family:Consolas,Menlo,monospace;font-size:13px;line-height:19px;white-space:pre-wrap">${esc(f.fixPrompt)}</div>
      <p style="margin:10px 0 0;font-family:${BODY_FONT};font-size:13px;line-height:19px;color:${C.muted}">${esc(f.engineerNote)}</p>
    </td></tr>`,
    "margin-bottom:12px",
  );
}

const spacer = `<div style="height:12px;line-height:12px;font-size:0">&nbsp;</div>`;

// ── Technical (Building / MVP / Scaling) ────────────────────────────────────

export function technicalReportEmail(args: {
  name: string;
  result: Result;
  findings: Finding[];
  nextStage: { title: string; items: string[] };
  overflow: { text: string }[];
  aiModules: { label: string; reason?: string }[];
  invite: string;
  bookingUrl: string;
}) {
  const { result } = args;
  const diy = args.findings.filter((f) => f.diy);
  const engineer = args.findings.filter((f) => !f.diy);

  const score = block(
    table(
      `<tr><td style="background:${C.soft};padding:24px 28px;border:1px solid ${C.line}">
        <p style="margin:0;font-family:${FONT};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.muted}">${esc(STAGE_COPY[result.stage])}</p>
        <p style="margin:6px 0 4px;font-family:${FONT};font-size:56px;line-height:60px;font-weight:700;color:${C.orange}">${result.overall}<span style="font-size:22px;color:${C.muted}">/100</span></p>
        <p style="margin:0;font-family:${BODY_FONT};font-size:13px;color:${C.muted}">Measured against what matters at your stage.</p>
      </td></tr>`,
    ),
  );

  const flags = result.flags.length
    ? block(
        table(
          `<tr><td style="border:2px solid #ef4444;background:#fef2f2;padding:18px 20px">
            <p style="margin:0 0 10px;font-family:${FONT};font-size:16px;font-weight:700;color:#b91c1c">&#9888; Critical issues</p>
            ${table(result.flags.map((f) => `<tr><td style="padding:3px 0;font-family:${BODY_FONT};font-size:15px;line-height:22px;color:${C.text}">&bull; ${esc(f.title)}</td></tr>`).join(""))}
          </td></tr>`,
        ),
      )
    : "";

  const areas = block(
    h2("By area") +
      table(
        result.areas
          .map((a) => {
            const s = STATUS[a.status];
            return `<tr>
              <td style="padding:11px 0;border-bottom:1px solid ${C.line};font-family:${BODY_FONT};font-size:15px;color:${C.text}">${esc(a.label)}</td>
              <td align="right" style="padding:11px 12px;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:15px;font-weight:700;color:${C.text}">${a.score}</td>
              <td align="right" width="110" style="padding:11px 0;border-bottom:1px solid ${C.line}">${pill(s.label, s.color, s.bg)}</td>
            </tr>`;
          })
          .join(""),
      ),
  );

  const body = [
    score,
    flags,
    areas,
    diy.length ? block(h2("You can fix these yourself") + diy.map(findingCard).join(spacer)) : "",
    engineer.length ? block(h2("Where teams usually bring in an engineer") + engineer.map(findingCard).join(spacer)) : "",
    block(h2(`Coming up: ${args.nextStage.title}`) + bullets(args.nextStage.items)),
    args.overflow.length ? block(h2("Also worth checking") + bullets(args.overflow.map((o) => o.text))) : "",
    args.aiModules.length
      ? block(
          h2("Why we asked some extra questions") +
            args.aiModules.map((m) => p(`<strong>${esc(m.label)}:</strong> ${esc(m.reason)}`, "font-size:14px")).join(""),
        )
      : "",
    result.complianceAsked
      ? block(p("The compliance questions are a checklist, not legal advice. Check with a lawyer what applies to you.", `font-size:12px;color:${C.muted}`), "0 40px 16px")
      : "",
    offerBlock(result.offer, args.invite, args.bookingUrl),
  ].join("");

  return {
    subject: `Your technical review: ${result.overall}/100`,
    html: shell(args.name, "Technical review", body),
  };
}

// ── Idea ────────────────────────────────────────────────────────────────────

function productCard(profile: IdeaProfile) {
  const rows = profile.rows
    .map(
      (r) => `<tr>
        <td width="16" valign="top" style="padding:12px 0 12px 20px;border-top:1px solid ${C.line};font-size:14px;line-height:20px;color:${TONE[r.tone]}">&#9679;</td>
        <td width="42%" valign="top" style="padding:12px 10px;border-top:1px solid ${C.line};font-family:${BODY_FONT};font-size:14px;line-height:20px;color:${C.muted}">${esc(r.label)}</td>
        <td valign="top" style="padding:12px 20px 12px 0;border-top:1px solid ${C.line};font-family:${BODY_FONT};font-size:14px;line-height:20px;${r.tone === "warn" ? `font-weight:700;color:#c2410c` : `color:${C.text}`}">${esc(r.value)}</td>
      </tr>`,
    )
    .join("");

  return table(
    `<tr><td style="border-left:4px solid ${C.orange};background:${C.soft};padding:22px 24px">
      ${profile.product ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:20px;line-height:27px;font-weight:600;color:${C.text}">&ldquo;${esc(profile.product)}&rdquo;</p>` : ""}
      ${profile.audience ? p(`For ${esc(profile.audience)}`, `color:${C.muted};font-size:14px;margin-bottom:14px`) : ""}
      ${profile.tags.length ? `<div>${profile.tags.map(tag).join("")}</div>` : ""}
    </td></tr>
    <tr><td style="border:1px solid ${C.line};border-top:0">${table(rows)}</td></tr>
    <tr><td style="padding:10px 0 0;font-family:${BODY_FONT};font-size:12px;color:${C.muted}">
      <span style="color:#22c55e">&#9679;</span> Looks good &nbsp;&nbsp; <span style="color:${C.orange}">&#9679;</span> Worth a look &mdash; see the gaps below
    </td></tr>`,
  );
}

function gapCard(g: IdeaGap, n: number) {
  return table(
    `<tr>
      <td width="44" valign="top" style="padding:0">
        <div style="width:32px;height:32px;line-height:32px;border-radius:16px;background:${C.orange};color:#111111;text-align:center;font-family:${FONT};font-size:15px;font-weight:700">${n}</div>
      </td>
      <td valign="top" style="padding:4px 0 0">
        <p style="margin:0 0 6px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.text}">${esc(g.title)}</p>
        ${p(esc(g.explanation), "font-size:14px;line-height:21px")}
        ${p(`<strong style="color:#c2410c">Next step:</strong> ${esc(g.nextStep)}`, "font-size:14px;line-height:21px;margin:0")}
      </td>
    </tr>`,
    "margin-bottom:20px",
  );
}

export function ideaReportEmail(args: {
  name: string;
  profile: IdeaProfile;
  gaps: IdeaGap[];
  invite: string;
  bookingUrl: string;
}) {
  const body = [
    block(h2("What you told us") + productCard(args.profile)),
    block(h2("3 gaps to look at") + args.gaps.map((g, i) => gapCard(g, i + 1)).join("")),
    offerBlock({ primary: "free_consult", secondary: [] }, args.invite, args.bookingUrl),
  ].join("");
  return { subject: "Your product idea review", html: shell(args.name, "Product idea review", body) };
}
