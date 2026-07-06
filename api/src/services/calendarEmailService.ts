import path from "path";
import { sendEmail } from "../utils/email";

export interface MeetingInvitationData {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  meetingType: string;
  hostEmail?: string;
  roles?: Record<string, string>;
  participantName?: string;
  participantEmail: string;
  organizerName: string;
  timezone: string;
}

// ─── Brand tokens — mirrors tailwind.config.ts exactly ───────────────────────
const B = {
  primary:     "#3363AD",              // primary.DEFAULT
  secondary:   "#595F74",              // secondary.DEFAULT
  dark:        "#373449",              // dark
  destructive: "#EF4444",              // destructive (hsl 0 84.2% 60.2%)
  pageBg:      "#EFF1F8",              // background
  white:       "#FFFFFF",
  textMain:    "#111827",              // foreground
  textMuted:   "#6B7280",
  border:      "#E5E7EB",
  // gradients
  gradDark:    "linear-gradient(135deg, #373449 0%, #3363AD 100%)", // gradient-dark
};

// Accent per email type — all from the system palette
const ACCENT = {
  invite: B.primary,
  update: B.secondary,
  cancel: B.destructive,
};

const LOGO_PATH = path.join(__dirname, "../assets/chw.png");
const LOGO_CID  = "logo@chw";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: Date, tz: string, opts: Intl.DateTimeFormatOptions) =>
  d.toLocaleString("fr-RW", { timeZone: tz, ...opts });

const fmtFull = (d: Date, tz: string) =>
  fmt(d, tz, { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

const fmtDate = (d: Date, tz: string) =>
  fmt(d, tz, { year: "numeric", month: "long", day: "numeric" });

const fmtTime = (d: Date, tz: string) =>
  fmt(d, tz, { hour: "2-digit", minute: "2-digit", hour12: false });

const logo = (size = 40) =>
  `<img src="cid:${LOGO_CID}" alt="Akili CHW" width="${size}" height="${size}"
     style="display:block;border-radius:${Math.round(size * 0.22)}px;object-fit:contain;border:1.5px solid rgba(255,255,255,0.25);" />`;

const inlineAttachments = [{ filename: "chw.png", path: LOGO_PATH, cid: LOGO_CID }];

// ─── Detail row (label + value, no icons) ────────────────────────────────────
function dRow(label: string, value: string, isLast = false): string {
  return `
  <tr>
    <td style="padding:14px 0 14px;${isLast ? "" : `border-bottom:1px solid ${B.border};`}">
      <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:1.2px;
                color:${B.textMuted};text-transform:uppercase;">${label}</p>
      <p style="margin:0;font-size:14px;color:${B.textMain};font-weight:500;line-height:1.4;">${value}</p>
    </td>
  </tr>`;
}

// ─── Base shell ───────────────────────────────────────────────────────────────
function shell(accentHex: string, statusLabel: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="rw">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Akili CHW</title>
</head>
<body style="margin:0;padding:0;background:${B.pageBg};font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${B.pageBg};padding:40px 16px;">
<tr><td align="center">

  <table width="560" cellpadding="0" cellspacing="0"
    style="max-width:560px;width:100%;background:${B.white};border-radius:12px;
           overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

    <!-- accent top bar -->
    <tr><td style="height:4px;background:${accentHex};"></td></tr>

    <!-- HEADER -->
    <tr>
      <td style="background:${B.gradDark};padding:22px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle">${logo(38)}</td>
                  <td valign="middle" style="padding-left:12px;">
                    <p style="margin:0;font-size:16px;font-weight:700;color:${B.white};letter-spacing:0.2px;">Akili CHW</p>
                    <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.55);">Urubuga rw'amahugurwa ya CHW</p>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" valign="middle">
              <span style="display:inline-block;border:1.5px solid rgba(255,255,255,0.25);
                           border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;
                           color:rgba(255,255,255,0.8);letter-spacing:0.3px;">${statusLabel}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- BODY -->
    <tr><td style="padding:36px 32px 28px;">${body}</td></tr>

    <!-- FOOTER -->
    <tr>
      <td style="background:${B.pageBg};border-top:1px solid ${B.border};padding:20px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle">
              <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:${B.primary};">Akili CHW Platform</p>
              <p style="margin:0;font-size:11px;color:${B.textMuted};line-height:1.6;">
                Iyi message yoherejwe n'Urubuga rw'amahugurwa ya CHW.<br/>
                Niba ufite ibibazo, vugana n'umunyamabanga w'inama.
              </p>
            </td>
            <td valign="middle" align="right">${logo(28)}</td>
          </tr>
        </table>
      </td>
    </tr>

  </table>

  <p style="margin:16px 0 0;font-size:11px;color:${B.secondary};text-align:center;">
    © 2025 Akili CHW &nbsp;·&nbsp; Murakoze gukoresha serivisi zacu
  </p>

</td></tr>
</table>
</body>
</html>`;
}

// ─── Meeting hero card ────────────────────────────────────────────────────────
function meetingCard(title: string, description: string | undefined, accentHex: string): string {
  return `
  <div style="border-left:4px solid ${accentHex};background:${B.pageBg};
              border-radius:0 10px 10px 0;padding:16px 20px;margin:20px 0 24px;">
    <p style="margin:0 0 5px;font-size:11px;font-weight:700;letter-spacing:1.2px;
              color:${B.textMuted};text-transform:uppercase;">Inama</p>
    <h2 style="margin:0 0 ${description ? "6px" : "0"};font-size:20px;font-weight:700;
               color:${B.dark};line-height:1.25;">${title}</h2>
    ${description ? `<p style="margin:0;font-size:13px;color:${B.textMuted};line-height:1.5;">${description}</p>` : ""}
  </div>`;
}

// ─── Date chip ────────────────────────────────────────────────────────────────
function dateChip(date: Date, endDate: Date | undefined, tz: string, accentHex: string): string {
  const dateStr = fmtDate(date, tz);
  const startT  = fmtTime(date, tz);
  const endT    = endDate ? fmtTime(endDate, tz) : null;
  return `
  <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr>
      <td style="background:${accentHex};border-radius:8px 0 0 8px;padding:12px 18px;text-align:center;min-width:60px;">
        <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,0.75);text-transform:uppercase;">Italiki</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:${B.white};line-height:1;">${fmt(date, tz, { day: "numeric" })}</p>
        <p style="margin:3px 0 0;font-size:10px;font-weight:600;color:rgba(255,255,255,0.8);text-transform:uppercase;">${fmt(date, tz, { month: "short" })}</p>
      </td>
      <td style="background:${B.pageBg};border-radius:0 8px 8px 0;padding:12px 20px;border:1px solid ${B.border};border-left:none;">
        <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:${B.textMain};">${dateStr}</p>
        <p style="margin:0;font-size:13px;color:${B.textMuted};">
          ${startT}${endT ? ` &rarr; ${endT}` : ""}
        </p>
      </td>
    </tr>
  </table>`;
}

// ─── sendMeetingInvitation ────────────────────────────────────────────────────
export class CalendarEmailService {
  static async sendMeetingInvitation(data: MeetingInvitationData): Promise<void> {
    const { title, description, startTime, endTime, location, hostEmail,
            roles, participantName, participantEmail, organizerName, timezone } = data;

    const greeting = participantName || "Umutumirwa";
    const startFmt = fmtFull(startTime, timezone);
    const endFmt   = endTime ? fmtFull(endTime, timezone) : null;

    const rolesSection = roles && Object.keys(roles).length > 0
      ? `<div style="margin:24px 0;">
           <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:1.2px;
                     color:${B.textMuted};text-transform:uppercase;">Inshingano mu nama</p>
           <table cellpadding="0" cellspacing="0" width="100%">
             ${Object.entries(roles).map(([role, name]) => `
             <tr>
               <td style="padding:6px 0;border-bottom:1px solid ${B.border};">
                 <span style="font-size:11px;font-weight:700;color:${B.secondary};
                              text-transform:uppercase;letter-spacing:0.5px;">${role}</span>
                 <span style="font-size:14px;color:${B.textMain};margin-left:12px;">${name}</span>
               </td>
             </tr>`).join("")}
           </table>
         </div>`
      : "";

    const body = `
      <p style="margin:0 0 6px;font-size:13px;color:${B.textMuted};">Muraho, <strong style="color:${B.textMain};">${greeting}</strong></p>
      <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:${B.dark};">Witabiriwe Inama</h1>
      <p style="margin:0 0 28px;font-size:14px;color:${B.textMuted};line-height:1.5;">
        Mwatumiwe kwitabira inama ikurikira. Reba amakuru yayo hepfo.
      </p>

      ${meetingCard(title, description, ACCENT.invite)}
      ${dateChip(startTime, endTime, timezone, ACCENT.invite)}

      <table cellpadding="0" cellspacing="0" width="100%"
        style="border:1px solid ${B.border};border-radius:10px;padding:0 20px;margin-bottom:24px;">
        ${location  ? dRow("Ahantu / Uhuze", location) : ""}
        ${hostEmail ? dRow("Imeyili y'umuyobozi", hostEmail) : ""}
        ${dRow("Umunyamabanga", organizerName)}
        ${dRow("Akarere k'igihe", timezone, true)}
      </table>

      ${rolesSection}

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0 4px;">
        <p style="margin:0 0 16px;font-size:14px;color:${B.textMuted};">
          Turabinginze mwitabire inama <strong>mu igihe cyagenwe</strong>.
        </p>
        <span style="display:inline-block;background:${ACCENT.invite};color:${B.white};
                     border-radius:8px;padding:12px 32px;font-size:14px;font-weight:700;
                     letter-spacing:0.3px;">Shyira mu gahunda yawe</span>
      </div>`;

    const html  = shell(ACCENT.invite, "Ubutumire", body);
    const plain = `Muraho ${greeting},\n\nUtumiwe kwitabira inama: ${title}\nItangira: ${startFmt}\n${endFmt ? `Isozwa: ${endFmt}\n` : ""}${location ? `Ahantu: ${location}\n` : ""}Umunyamabanga: ${organizerName}\n\nMurakoze,\n${organizerName}`;

    try {
      await sendEmail({ to: participantEmail, subject: `Ubutumire bw'inama: ${title}`, body: plain, html, attachments: inlineAttachments });
    } catch (err) {
      console.error("Failed to send meeting invitation email:", err);
      throw err;
    }
  }

  // ─── sendMeetingUpdate ──────────────────────────────────────────────────────
  static async sendMeetingUpdate(data: MeetingInvitationData & { changes: string[] }): Promise<void> {
    const { title, description, startTime, endTime, location, organizerName,
            participantName, participantEmail, timezone, changes } = data;

    const AMBER   = ACCENT.update;
    const greeting = participantName || "Uwitabiriwe";
    const startFmt = fmtFull(startTime, timezone);
    const endFmt   = endTime ? fmtFull(endTime, timezone) : null;

    const changesList = (changes.length > 0 ? changes : ["Inama yavuguruwe — reba amakuru mashya."])
      .map(c => `<tr><td style="padding:5px 0;font-size:13px;color:${B.textMain};">· ${c}</td></tr>`).join("");

    const body = `
      <p style="margin:0 0 6px;font-size:13px;color:${B.textMuted};">Muraho, <strong style="color:${B.textMain};">${greeting}</strong></p>
      <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:${AMBER};">Inama Ivuguruwe</h1>
      <p style="margin:0 0 28px;font-size:14px;color:${B.textMuted};line-height:1.5;">
        Inama mwari mwitabiriwe yavuguruwe. Reba impinduka hepfo.
      </p>

      ${meetingCard(title, description, AMBER)}
      ${dateChip(startTime, endTime, timezone, AMBER)}

      <!-- What changed -->
      <div style="border-left:4px solid ${ACCENT.update};background:${B.pageBg};
                  border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:1.2px;
                  color:${ACCENT.update};text-transform:uppercase;">Ibihindutse</p>
        <table cellpadding="0" cellspacing="0" width="100%">${changesList}</table>
      </div>

      <!-- Updated details -->
      <table cellpadding="0" cellspacing="0" width="100%"
        style="border:1px solid ${B.border};border-radius:10px;padding:0 20px;margin-bottom:8px;">
        ${dRow("Itangira (gishya)", startFmt)}
        ${endFmt   ? dRow("Isozwa (gishya)", endFmt) : ""}
        ${location ? dRow("Ahantu", location) : ""}
        ${dRow("Umunyamabanga", organizerName, true)}
      </table>`;

    const html  = shell(AMBER, "Ivuguruwe", body);
    const plain = `Muraho ${greeting},\n\nInama yavuguruwe: ${title}\nItangira: ${startFmt}\n${endFmt ? `Isozwa: ${endFmt}\n` : ""}${location ? `Ahantu: ${location}\n` : ""}${changes.length ? "\nIbihindutse:\n" + changes.map(c => `· ${c}`).join("\n") : ""}\n\nMurakoze,\n${organizerName}`;

    try {
      await sendEmail({ to: participantEmail, subject: `Inama ivuguruwe: ${title}`, body: plain, html, attachments: inlineAttachments });
    } catch (err) {
      console.error("Failed to send meeting update email:", err);
      throw err;
    }
  }

  // ─── sendMeetingCancellation ────────────────────────────────────────────────
  static async sendMeetingCancellation(data: MeetingInvitationData): Promise<void> {
    const { title, description, organizerName, participantName,
            participantEmail, startTime, timezone } = data;

    const RED      = ACCENT.cancel;
    const greeting = participantName || "Uwitabiriwe";
    const startFmt = fmtFull(startTime, timezone);

    const body = `
      <p style="margin:0 0 6px;font-size:13px;color:${B.textMuted};">Muraho, <strong style="color:${B.textMain};">${greeting}</strong></p>
      <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:${RED};">Inama Ihagaritswe</h1>
      <p style="margin:0 0 28px;font-size:14px;color:${B.textMuted};line-height:1.5;">
        Inama mwari mwitabiriwe yhagaritswe. Twihanganira kutibuka.
      </p>

      <!-- Cancelled card -->
      <div style="border:1.5px solid ${RED};background:${B.pageBg};border-radius:10px;
                  padding:24px;margin-bottom:24px;text-align:center;">
        <div style="width:48px;height:48px;background:${RED};border-radius:50%;
                    margin:0 auto 14px;line-height:48px;font-size:22px;color:${B.white};font-weight:700;">✕</div>
        <h3 style="margin:0 0 ${description ? "6px" : "14px"};font-size:18px;font-weight:700;color:${B.dark};">${title}</h3>
        ${description ? `<p style="margin:0 0 14px;font-size:13px;color:${B.textMuted};line-height:1.5;">${description}</p>` : ""}
        <p style="margin:0;font-size:12px;color:${B.secondary};">
          <strong>Yari igenwe:</strong> ${startFmt}
        </p>
      </div>

      <table cellpadding="0" cellspacing="0" width="100%"
        style="border:1px solid ${B.border};border-radius:10px;padding:0 20px;margin-bottom:20px;">
        ${dRow("Umunyamabanga", organizerName, true)}
      </table>

      <p style="margin:0;font-size:13px;color:${B.textMuted};line-height:1.6;">
        Niba ufite ibibazo, vugana na <strong style="color:${B.textMain};">${organizerName}</strong>.
      </p>`;

    const html  = shell(RED, "Ihagaritswe", body);
    const plain = `Muraho ${greeting},\n\nInama ihagaritswe: ${title}\n${description ? `Ibisobanuro: ${description}\n` : ""}Yari igenwe: ${startFmt}\n\nNiba ufite ibibazo, vugana n'umunyamabanga w'inama.\n\nMurakoze,\n${organizerName}`;

    try {
      await sendEmail({ to: participantEmail, subject: `Inama ihagaritswe: ${title}`, body: plain, html, attachments: inlineAttachments });
    } catch (err) {
      console.error("Failed to send meeting cancellation email:", err);
      throw err;
    }
  }
}
