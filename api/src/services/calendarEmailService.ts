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

export class CalendarEmailService {
  static async sendMeetingInvitation(
    data: MeetingInvitationData,
  ): Promise<void> {
    const {
      title,
      description,
      startTime,
      endTime,
      location,
      hostEmail,
      roles,
      participantName,
      participantEmail,
      organizerName,
      timezone,
    } = data;

    const subject = `Ubutumire bw'inama: ${title}`;

    const formatDateTime = (date: Date): string => {
      return date.toLocaleString("fr-RW", {
        timeZone: timezone,
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    };

    const startDateTime = formatDateTime(startTime);
    const endDateTime = endTime ? formatDateTime(endTime) : null;

    const rolesText =
      roles && Object.keys(roles).length > 0
        ? `\n\nInshingano:\n${Object.entries(roles)
            .map(([role, name]) => `• ${role}: ${name}`)
            .join("\n")}`
        : "";

    const body = `
Muraho ${participantName || "Umutumirwa"},

Utumiwe kwitabira inama ikurikira:

Inama: ${title}
${description ? `Ibisobanuro: ${description}` : ""}
Iratangira: ${startDateTime}
${endDateTime ? `Irasozwa: ${endDateTime}` : ""}
${location ? `Icyerekezo: ${location}` : ""}
${hostEmail ? `Imeyili y'umuyobozi: ${hostEmail}` : ""}
Umunyamabanga: ${organizerName}
Akarere k'igihe: ${timezone}${rolesText}

Turabinginze mwitabire inama mu igihe cyagenwe.

Murakoze,
${organizerName}
Urubuga rw'amahugurwa ya CHW
    `.trim();

    try {
      await sendEmail({
        to: participantEmail,
        subject,
        body,
      });
    } catch (error) {
      console.error("Failed to send meeting invitation email:", error);
      throw error;
    }
  }

  static async sendMeetingUpdate(
    data: MeetingInvitationData & { changes: string[] },
  ): Promise<void> {
    const subject = `Inama ivuguruwe: ${data.title}`;

    const formatDateTime = (date: Date): string => {
      return date.toLocaleString("fr-RW", {
        timeZone: data.timezone,
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    };

    const startDateTime = formatDateTime(data.startTime);
    const endDateTime = data.endTime ? formatDateTime(data.endTime) : null;

    const body = `
Muraho ${data.participantName || "Uwitabiriwe"},

Inama ikurikira yavuguruwe:

Inama: ${data.title}
${data.description ? `Ibisobanuro: ${data.description}` : ""}
Itangira: ${startDateTime}
${endDateTime ? `Isozwa: ${endDateTime}` : ""}
${data.location ? `Aho bahuriranye/Uhuze: ${data.location}` : ""}

Reba amakuru mashya y'inama.

Murakoze,
${data.organizerName}
Urubuga rw'amahugurwa ya CHW
    `.trim();

    try {
      await sendEmail({
        to: data.participantEmail,
        subject,
        body,
      });
    } catch (error) {
      console.error("Failed to send meeting update email:", error);
      throw error;
    }
  }

  static async sendMeetingCancellation(
    data: MeetingInvitationData,
  ): Promise<void> {
    const subject = `Inama ihagaritswe: ${data.title}`;

    const body = `
Muraho ${data.participantName || "Uwitabiriwe"},

Inama ikurikira ihagaritswe:

Inama: ${data.title}
${data.description ? `Ibisobanuro: ${data.description}` : ""}

Niba ufite ibibazo, vugana n'umunyamabanga w'inama.

Murakoze,
${data.organizerName}
Urubuga rw'amahugurwa ya CHW
    `.trim();

    try {
      await sendEmail({
        to: data.participantEmail,
        subject,
        body,
      });
    } catch (error) {
      console.error("Failed to send meeting cancellation email:", error);
      throw error;
    }
  }
}
