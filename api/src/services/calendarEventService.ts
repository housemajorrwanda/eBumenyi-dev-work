/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "../utils/client";
import { v4 as uuidv4 } from "uuid";
import AppError from "../utils/error";
import {
  CalendarEventResponse,
  CalendarFrequency,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  CalendarEventType,
  MeetingType,
  EventPriority,
} from "../utils/interfaces/common";
import { CalendarEmailService } from "./calendarEmailService";
import { NotificationService } from "./NotificationService";

const DEFAULT_TIMEZONE = "Africa/Kigali";
const DEFAULT_REMINDER_MINUTES = 30;

type ParticipantWithUser = {
  id: string;
  userId: string;
  user?: {
    id: string;
    fullNames: string;
    email: string | null;
    phoneNumber: string;
  } | null;
};

type UserPreview = {
  id: string;
  fullNames: string;
  email: string | null;
  phoneNumber: string;
};

type ExternalParticipant = {
  id: string;
  email: string;
  name: string | null;
};

type CalendarEventWithRelations = {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  frequency: CalendarFrequency;
  daysOfWeek: number[];
  timezone: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  reminderMinutesBefore: number[];
  recurrenceEndsAt: Date | null;
  meetingType: MeetingType | null;
  location: string | null;
  streamRoomId: string | null;
  priority: EventPriority;
  hostEmail: string | null;
  createdById: string;
  isRepeating: boolean;
  commonId: string | null;
  isCancelled: boolean;
  createdAt: Date;
  updatedAt: Date;
  participants: ParticipantWithUser[];
  externalParticipants: ExternalParticipant[];
  attachments: Array<{ id: string; name: string; url: string }>;
};

export class CalendarEventService {
  private static get delegate() {
    return prisma.calendarEvent;
  }

  private static readonly includeConfig = {
    participants: {
      select: {
        id: true,
        userId: true,
      },
    },
    externalParticipants: true,
    attachments: true,
  } as const;

  private static readonly participantUserSelect = {
    id: true,
    fullNames: true,
    email: true,
    phoneNumber: true,
  } as const;

  public static async createEvent(
    userId: string,
    payload: CreateCalendarEventDto,
    io?: any,
  ) {
    console.log("[CALENDAR EVENT] Creating new event for user:", userId);
    console.log("[CALENDAR EVENT] Socket IO instance available:", !!io);
    const {
      title,
      description,
      type = "TRAINING",
      frequency = "NONE",
      daysOfWeek,
      timezone,
      startAt,
      endAt,
      allDay,
      reminderMinutesBefore,
      recurrenceEndsAt,
      meetingType,
      location,
      streamRoomId,
      priority = "MEDIUM",
      hostEmail,
      participants,
      externalParticipants,
      attachments,
    } = payload;

    const startDate = this.parseDate(startAt, "startAt");
    const endDate = endAt ? this.parseDate(endAt, "endAt") : null;
    const recurrenceEndsDate = recurrenceEndsAt
      ? this.parseDate(recurrenceEndsAt, "recurrenceEndsAt")
      : null;

    if (endDate && !allDay && endDate <= startDate) {
      throw new AppError("endAt must be after startAt", 400);
    }

    const normalizedFrequency = this.normalizeFrequency(frequency);
    const normalizedType = this.normalizeType(type);
    const normalizedDays = this.normalizeDaysOfWeek(
      daysOfWeek,
      normalizedFrequency,
    );
    const normalizedReminder = this.normalizeReminder(reminderMinutesBefore);
    const resolvedTimezone = timezone?.trim() || DEFAULT_TIMEZONE;

    // Get creator info for notifications
    const creator = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullNames: true, email: true },
    });

    if (!creator) {
      throw new AppError("Creator not found", 404);
    }

    // Prepare participant data
    const participantData: Array<{
      userId: string;
    }> = [];
    const externalParticipantData: Array<{
      email: string;
      name?: string | null;
    }> = [];
    const attachmentData: Array<{
      name: string;
      url: string;
    }> = [];

    // Add creator as confirmed participant
    participantData.push({
      userId,
    });

    // Add internal participants
    if (participants) {
      for (const participant of participants) {
        if (participant.userId !== userId) {
          // Don't add creator twice
          participantData.push({
            userId: participant.userId,
          });
        }
      }
    }

    // Add external participants
    if (externalParticipants) {
      for (const participant of externalParticipants) {
        const normalized =
          typeof participant === "string"
            ? {
                email: participant,
                name: null,
              }
            : {
                email: participant.email,
                name: participant.name || null,
              };
        externalParticipantData.push(normalized);
      }
    }

    if (attachments) {
      for (const attachment of attachments) {
        if (!attachment?.url) continue;
        const name = this.resolveAttachmentName(attachment);
        attachmentData.push({
          name,
          url: attachment.url,
        });
      }
    }

    const created = (await this.delegate.create({
      data: {
        title,
        description: description ?? null,
        type: normalizedType,
        frequency: normalizedFrequency,
        daysOfWeek: normalizedDays,
        timezone: resolvedTimezone,
        startAt: startDate,
        endAt: endDate,
        allDay: allDay ?? false,
        reminderMinutesBefore: normalizedReminder,
        recurrenceEndsAt: recurrenceEndsDate,
        meetingType: meetingType ?? "EBUMENYI_MEETING",
        location,
        streamRoomId: streamRoomId ?? null,
        priority,
        hostEmail,
        createdById: userId,
        isRepeating: normalizedFrequency !== "NONE",
        commonId: normalizedFrequency !== "NONE" ? uuidv4() : null,
        participants: {
          createMany: {
            data: participantData,
          },
        },
        externalParticipants: {
          createMany: {
            data: externalParticipantData,
          },
        },
        attachments: {
          createMany: {
            data: attachmentData,
          },
        },
      } as any,
      include: this.includeConfig,
    })) as unknown as CalendarEventWithRelations;

    console.log(
      "[CALENDAR EVENT] Event created successfully in database:",
      created.id,
    );

    // Expand recurring events into individual instances
    if (created.frequency && created.frequency !== "NONE") {
      this.expandEventIntoInstances(created.id).catch((error) => {
        console.error("Failed to expand event instances:", error);
      });
    }

    // Send notifications and emails asynchronously
    this.sendEventNotifications(created, creator.fullNames, io).catch(
      (error) => {
        console.error("Failed to send event notifications:", error);
      },
    );

    return {
      message: "Event created successfully",
      statusCode: 201,
      data: await this.buildResponseEvent(created, userId),
    };
  }

  private static async sendEventNotifications(
    event: CalendarEventWithRelations,
    organizerName: string,
    io?: any,
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // Send notifications to internal participants
    console.log(
      "[CALENDAR EVENT] Sending notifications to",
      event.participants.length,
      "internal participants for event:",
      event.id,
    );
    for (const participant of event.participants) {
      if (participant.userId !== event.createdById) {
        console.log(
          "[CALENDAR EVENT] Notifying participant:",
          participant.userId,
        );
        promises.push(
          NotificationService.createNotification(
            participant.userId,
            `${event.title}`,
            `${event.description}`,
            "info",
            `/calendar/${event.id}`,
            "calendar_event",
            event.id,
            {
              eventType: event.type,
              meetingType: event.meetingType,
              startTime: event.startAt,
              location: event.location,
              timezone: event.timezone,
            },
            {
              cooldownMs: 300_000, // 5 minutes
              dedupKey: `calendar:${event.id}:created:${participant.userId}`,
            },
          )
            .then(async (notification) => {
              if (io) {
                console.log(
                  "[SOCKET EMIT] Broadcasting notification for event:",
                  event.id,
                  "to user:",
                  participant.userId,
                );
                const userRoom = `user:${participant.userId}`;
                const unreadCount = await NotificationService.getUnreadCount(
                  participant.userId,
                );
                // Emit the actual DB notification (includes id, so bell interactions work)
                io.to(userRoom).emit("notification", notification);
                io.to(userRoom).emit("unread_count_updated", { unreadCount });
              }
            })
            .catch((error) =>
              console.error(`Failed to notify ${participant.userId}:`, error),
            ),
        );
      }
    }

    // Ping the creator's socket so their CalendarScreen refetches without
    // adding a noisy bell notification (they know they just created the event).
    if (io && event.createdById) {
      io.to(`user:${event.createdById}`).emit("calendar_data_changed", {
        eventId: event.id,
        action: "created",
      });
    }

    // Send emails to external participants
    for (const externalParticipant of event.externalParticipants) {
      promises.push(
        CalendarEmailService.sendMeetingInvitation({
          title: event.title,
          description: event.description || undefined,
          startTime: event.startAt,
          endTime: event.endAt || undefined,
          location: event.location || undefined,
          meetingType: event.meetingType || "EBUMENYI_MEETING",
          hostEmail: event.hostEmail || undefined,
          participantEmail: externalParticipant.email,
          organizerName,
          timezone: event.timezone,
        }).catch((error) =>
          console.error(`Failed to email ${externalParticipant.email}:`, error),
        ),
      );
    }

    await Promise.allSettled(promises);
  }

  /**
   * Expand a recurring event into individual instances using commonId approach
   * Creates multiple CalendarEvent records with same commonId and different dates
   */
  private static async expandEventIntoInstances(
    eventId: string,
  ): Promise<void> {
    try {
      const event = (await this.delegate.findUnique({
        where: { id: eventId },
        include: this.includeConfig,
      })) as unknown as CalendarEventWithRelations | null;

      if (!event || event.frequency === "NONE" || !event.commonId) {
        return;
      }

      // Generate occurrences
      const occurrences = this.generateRecurrences(event);

      // Create additional CalendarEvent records for each occurrence
      // (the first one was already created as the template)
      const participantIds = event.participants.map((p) => ({
        userId: p.userId,
      }));
      const externalParticipantEmails = event.externalParticipants.map((p) => ({
        email: p.email,
        name: p.name,
      }));
      const attachmentData = event.attachments.map((a) => ({
        name: a.name,
        url: a.url,
      }));

      // Skip first occurrence (already created), create rest in parallel for better performance
      // NOTE: We preserve frequency, daysOfWeek, and recurrenceEndsAt for each occurrence
      // so the series metadata is available in responses
      const createPromises = occurrences.slice(1).map((occ) =>
        this.delegate.create({
          data: {
            title: event.title,
            description: event.description,
            type: event.type,
            frequency: event.frequency,
            daysOfWeek: event.daysOfWeek,
            timezone: event.timezone,
            startAt: occ.start,
            endAt: occ.end,
            allDay: event.allDay,
            reminderMinutesBefore: event.reminderMinutesBefore,
            recurrenceEndsAt: event.recurrenceEndsAt,
            meetingType: event.meetingType,
            location: event.location,
            priority: event.priority,
            hostEmail: event.hostEmail,
            createdById: event.createdById,
            isRepeating: true,
            commonId: event.commonId,
            participants: {
              createMany: { data: participantIds },
            },
            externalParticipants: {
              createMany: { data: externalParticipantEmails },
            },
            attachments: {
              createMany: { data: attachmentData },
            },
          } as any,
        }),
      );

      await Promise.all(createPromises);

      console.log(
        `[CALENDAR EVENT] Expanded event ${eventId} into ${occurrences.length} instances with commonId: ${event.commonId}`,
      );
    } catch (error) {
      console.error("Error expanding event into instances:", error);
    }
  }

  /**
   * Smart expand/cleanup for recurring series
   * Intelligently handles changes to:
   * - recurrenceEndsAt: extends/shortens series
   * - daysOfWeek: regenerates occurrences to match new pattern
   * - frequency: regenerates entire series
   */
  private static async smartExpandAndCleanupSeries(
    commonId: string,
    templateEvent: CalendarEventWithRelations,
    originalEvent?: CalendarEventWithRelations,
  ): Promise<void> {
    try {
      // Get all current occurrences
      const currentOccurrences = (await this.delegate.findMany({
        where: { commonId } as any,
        orderBy: { startAt: "asc" },
        include: this.includeConfig,
      })) as unknown as CalendarEventWithRelations[];

      if (currentOccurrences.length === 0) return;

      // Check if frequency or daysOfWeek changed (requires regeneration)
      const frequencyChanged =
        originalEvent && originalEvent.frequency !== templateEvent.frequency;
      const daysOfWeekChanged =
        originalEvent &&
        JSON.stringify(originalEvent.daysOfWeek || []) !==
          JSON.stringify(templateEvent.daysOfWeek || []);

      // If pattern changed (daysOfWeek or frequency), regenerate entire series
      if (frequencyChanged || daysOfWeekChanged) {
        await this.regenerateSeries(
          commonId,
          templateEvent,
          currentOccurrences,
        );
        return;
      }

      // Otherwise, just handle end date expansion/contraction
      const newRecurrenceEndsAt = templateEvent.recurrenceEndsAt;

      // Generate occurrences based on updated series config
      const generatedOccurrences = this.generateRecurrences(templateEvent);

      // Find the last generated occurrence
      const lastGeneratedStart =
        generatedOccurrences.length > 0
          ? generatedOccurrences[generatedOccurrences.length - 1].start
          : null;

      // Find the last current occurrence
      const lastCurrentStart =
        currentOccurrences.length > 0
          ? currentOccurrences[currentOccurrences.length - 1].startAt
          : null;

      // Case 1: Series extended - create new occurrences
      if (
        lastGeneratedStart &&
        lastCurrentStart &&
        lastGeneratedStart > lastCurrentStart
      ) {
        const newOccurrences = generatedOccurrences.filter(
          (gen) => gen.start > lastCurrentStart,
        );

        if (newOccurrences.length > 0) {
          const participantIds = templateEvent.participants.map((p) => ({
            userId: p.userId,
          }));
          const externalParticipantEmails =
            templateEvent.externalParticipants.map((p) => ({
              email: p.email,
              name: p.name,
            }));
          const attachmentData = templateEvent.attachments.map((a) => ({
            name: a.name,
            url: a.url,
          }));

          const createPromises = newOccurrences.map((occ) =>
            this.delegate.create({
              data: {
                title: templateEvent.title,
                description: templateEvent.description,
                type: templateEvent.type,
                frequency: templateEvent.frequency,
                daysOfWeek: templateEvent.daysOfWeek,
                timezone: templateEvent.timezone,
                startAt: occ.start,
                endAt: occ.end,
                allDay: templateEvent.allDay,
                reminderMinutesBefore: templateEvent.reminderMinutesBefore,
                recurrenceEndsAt: templateEvent.recurrenceEndsAt,
                meetingType: templateEvent.meetingType,
                location: templateEvent.location,
                priority: templateEvent.priority,
                hostEmail: templateEvent.hostEmail,
                createdById: templateEvent.createdById,
                isRepeating: true,
                commonId: templateEvent.commonId,
                participants: {
                  createMany: { data: participantIds },
                },
                externalParticipants: {
                  createMany: { data: externalParticipantEmails },
                },
                attachments: {
                  createMany: { data: attachmentData },
                },
              } as any,
            }),
          );

          await Promise.all(createPromises);
          console.log(
            `[CALENDAR EVENT] Created ${newOccurrences.length} new occurrences for series ${commonId}`,
          );
        }
      }

      // Case 2: Series shortened - delete occurrences beyond new end date
      if (newRecurrenceEndsAt) {
        const occurrencesToDelete = currentOccurrences.filter(
          (occ) => occ.startAt > newRecurrenceEndsAt,
        );

        if (occurrencesToDelete.length > 0) {
          const deletePromises = occurrencesToDelete.map((occ) =>
            this.delegate.delete({ where: { id: occ.id } }),
          );
          await Promise.all(deletePromises);
          console.log(
            `[CALENDAR EVENT] Deleted ${occurrencesToDelete.length} occurrences beyond new end date for series ${commonId}`,
          );
        }
      }

      // Update all remaining occurrences with new metadata
      await this.delegate.updateMany({
        where: { commonId } as any,
        data: {
          recurrenceEndsAt: newRecurrenceEndsAt,
          daysOfWeek: templateEvent.daysOfWeek,
          frequency: templateEvent.frequency,
        },
      });

      console.log(
        `[CALENDAR EVENT] Updated recurrenceEndsAt, daysOfWeek, and frequency for all occurrences in series ${commonId}`,
      );
    } catch (error) {
      console.error(
        `[CALENDAR EVENT] Error in smartExpandAndCleanupSeries for ${commonId}:`,
        error,
      );
      // Don't throw - log and continue so update still succeeds
    }
  }

  /**
   * Regenerate entire series when pattern changes (daysOfWeek or frequency)
   * Preserves user's original event times and metadata
   */
  private static async regenerateSeries(
    commonId: string,
    templateEvent: CalendarEventWithRelations,
    currentOccurrences: CalendarEventWithRelations[],
  ): Promise<void> {
    try {
      // Generate new occurrences with updated pattern
      const newOccurrences = this.generateRecurrences(templateEvent);

      if (newOccurrences.length === 0) return;

      // Map old occurrences by date for reference
      const oldOccurrencesByDate = new Map<
        string,
        CalendarEventWithRelations
      >();
      currentOccurrences.forEach((occ) => {
        const dateKey = occ.startAt.toISOString().split("T")[0];
        oldOccurrencesByDate.set(dateKey, occ);
      });

      // Identify which old occurrences to delete (not in new pattern)
      const newOccurrenceDates = new Set(
        newOccurrences.map((o) => o.start.toISOString().split("T")[0]),
      );

      const toDelete = currentOccurrences.filter((occ) => {
        const dateKey = occ.startAt.toISOString().split("T")[0];
        return !newOccurrenceDates.has(dateKey);
      });

      // Delete occurrences no longer in pattern
      if (toDelete.length > 0) {
        const deletePromises = toDelete.map((occ) =>
          this.delegate.delete({ where: { id: occ.id } }),
        );
        await Promise.all(deletePromises);
        console.log(
          `[CALENDAR EVENT] Deleted ${toDelete.length} occurrences no longer matching new pattern for series ${commonId}`,
        );
      }

      // Identify which new occurrences need to be created
      const existingDates = new Set(
        currentOccurrences.map((o) => o.startAt.toISOString().split("T")[0]),
      );

      const toCreate = newOccurrences.filter((occ) => {
        const dateKey = occ.start.toISOString().split("T")[0];
        return !existingDates.has(dateKey);
      });

      // Create new occurrences matching pattern
      if (toCreate.length > 0) {
        const participantIds = templateEvent.participants.map((p) => ({
          userId: p.userId,
        }));
        const externalParticipantEmails =
          templateEvent.externalParticipants.map((p) => ({
            email: p.email,
            name: p.name,
          }));
        const attachmentData = templateEvent.attachments.map((a) => ({
          name: a.name,
          url: a.url,
        }));

        const createPromises = toCreate.map((occ) =>
          this.delegate.create({
            data: {
              title: templateEvent.title,
              description: templateEvent.description,
              type: templateEvent.type,
              frequency: templateEvent.frequency,
              daysOfWeek: templateEvent.daysOfWeek,
              timezone: templateEvent.timezone,
              startAt: occ.start,
              endAt: occ.end,
              allDay: templateEvent.allDay,
              reminderMinutesBefore: templateEvent.reminderMinutesBefore,
              recurrenceEndsAt: templateEvent.recurrenceEndsAt,
              meetingType: templateEvent.meetingType,
              location: templateEvent.location,
              priority: templateEvent.priority,
              hostEmail: templateEvent.hostEmail,
              createdById: templateEvent.createdById,
              isRepeating: true,
              commonId: templateEvent.commonId,
              participants: {
                createMany: { data: participantIds },
              },
              externalParticipants: {
                createMany: { data: externalParticipantEmails },
              },
              attachments: {
                createMany: { data: attachmentData },
              },
            } as any,
          }),
        );

        await Promise.all(createPromises);
        console.log(
          `[CALENDAR EVENT] Created ${toCreate.length} new occurrences matching new pattern for series ${commonId}`,
        );
      }

      // Update all remaining occurrences with new pattern metadata
      await this.delegate.updateMany({
        where: { commonId } as any,
        data: {
          frequency: templateEvent.frequency,
          daysOfWeek: templateEvent.daysOfWeek,
          recurrenceEndsAt: templateEvent.recurrenceEndsAt,
        },
      });

      console.log(
        `[CALENDAR EVENT] Regenerated series ${commonId} with new pattern`,
      );
    } catch (error) {
      console.error(
        `[CALENDAR EVENT] Error in regenerateSeries for ${commonId}:`,
        error,
      );
    }
  }

  public static async getEvents(
    userId: string,
    params: { start?: string; end?: string },
  ) {
    const { start, end } = params;

    const startDate = start ? this.parseDate(start, "start") : undefined;
    const endDate = end ? this.parseDate(end, "end") : undefined;

    if (startDate && endDate && endDate < startDate) {
      throw new AppError("end date must be after start date", 400);
    }

    // All users (including admins) can only see events they created or are participants in
    const where: Record<string, unknown> = {
      OR: [
        { createdById: userId },
        {
          participants: {
            some: {
              userId: userId,
            },
          },
        },
      ],
    };

    if (startDate || endDate) {
      const startFilter =
        (where.startAt as Record<string, Date>) ?? ({} as Record<string, Date>);

      if (startDate) {
        startFilter.gte = startDate;
      }

      if (endDate) {
        startFilter.lte = endDate;
      }

      where.startAt = startFilter;
    }

    const events = (await this.delegate.findMany({
      where,
      orderBy: { startAt: "asc" },
      include: this.includeConfig,
    })) as unknown as CalendarEventWithRelations[];

    // All recurring event instances are already created as separate CalendarEvent records in DB
    // They share the same commonId but each has its own startAt/endAt
    // So the initial query already returns all occurrences we need!
    const expandedEvents = await this.buildResponseEvents(events, userId);

    return {
      message: "Events fetched successfully",
      statusCode: 200,
      data: expandedEvents,
    };
  }

  /**
   * Generate occurrences of a recurring event within a date range
   */
  private static generateRecurrences(
    event: CalendarEventWithRelations,
    startDate?: Date,
    endDate?: Date,
  ): Array<{ start: Date; end: Date }> {
    const occurrences: Array<{ start: Date; end: Date }> = [];
    const frequency = event.frequency || "NONE";
    const daysOfWeek = event.daysOfWeek || [];
    const recurrenceEndsAt = event.recurrenceEndsAt;

    if (frequency === "NONE") {
      return [{ start: event.startAt, end: event.endAt || event.startAt }];
    }

    let current = new Date(event.startAt);
    const duration = event.endAt
      ? event.endAt.getTime() - event.startAt.getTime()
      : 0;

    // Determine the end date for recurrence generation
    let finalEndDate =
      recurrenceEndsAt ||
      new Date(
        event.startAt.getFullYear() + 1,
        event.startAt.getMonth(),
        event.startAt.getDate(),
      );

    // If a query endDate is provided, use the earlier one
    if (endDate && endDate < finalEndDate) {
      finalEndDate = endDate;
    }

    // Start from event date or query startDate, whichever is later
    if (startDate && startDate > current) {
      current = new Date(startDate);
      // Adjust current to align with recurrence pattern
      current = this.alignToRecurrencePattern(current, event);
    }

    while (current <= finalEndDate && occurrences.length < 500) {
      const occurrenceStart = new Date(current);
      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);

      // Only add if within query range
      if (!startDate || occurrenceStart >= startDate) {
        if (!endDate || occurrenceStart <= endDate) {
          occurrences.push({ start: occurrenceStart, end: occurrenceEnd });
        }
      }

      switch (frequency) {
        case "DAILY":
          current.setDate(current.getDate() + 1);
          break;
        case "WEEKLY":
          if (daysOfWeek.length > 0) {
            let found = false;
            for (let i = 1; i <= 7; i++) {
              const nextDate = new Date(current);
              nextDate.setDate(nextDate.getDate() + i);
              if (daysOfWeek.includes(nextDate.getDay())) {
                current = nextDate;
                found = true;
                break;
              }
            }
            if (!found) {
              current.setDate(current.getDate() + 7);
            }
          } else {
            current.setDate(current.getDate() + 7);
          }
          break;
        case "MONTHLY":
          current.setMonth(current.getMonth() + 1);
          break;
        default:
          break;
      }
    }

    return occurrences;
  }

  /**
   * Align a date to the recurrence pattern
   */
  private static alignToRecurrencePattern(
    date: Date,
    event: CalendarEventWithRelations,
  ): Date {
    const frequency = event.frequency || "NONE";
    const daysOfWeek = event.daysOfWeek || [];

    if (frequency === "WEEKLY" && daysOfWeek.length > 0) {
      // Find the next occurrence on a valid day of week
      for (let i = 0; i < 7; i++) {
        const testDate = new Date(date);
        testDate.setDate(testDate.getDate() + i);
        if (daysOfWeek.includes(testDate.getDay())) {
          return testDate;
        }
      }
    }

    return date;
  }

  public static async getEventById(userId: string, eventId: string) {
    const event = (await this.delegate.findUnique({
      where: { id: eventId },
      include: this.includeConfig,
    })) as unknown as CalendarEventWithRelations | null;

    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (!this.userCanAccessEvent(userId, event)) {
      throw new AppError("You are not allowed to view this event", 403);
    }

    return {
      message: "Event fetched successfully",
      statusCode: 200,
      data: await this.buildResponseEvent(event, userId),
    };
  }

  public static async updateEvent(
    eventId: string,
    userId: string,
    payload: UpdateCalendarEventDto,
    io?: any,
  ) {
    console.log(
      "[CALENDAR EVENT] Updating event:",
      eventId,
      "by user:",
      userId,
    );
    console.log("[CALENDAR EVENT] Socket IO instance available:", !!io);
    try {
      console.log("Update event payload:", JSON.stringify(payload, null, 2));
      const existing = (await this.delegate.findUnique({
        where: { id: eventId },
        include: this.includeConfig,
      })) as unknown as CalendarEventWithRelations | null;

      if (!existing) {
        throw new AppError("Event not found", 404);
      }

      if (existing.createdById !== userId) {
        throw new AppError("You are not allowed to update this event", 403);
      }

      const data = this.buildUpdateData(existing, payload);
      console.log("Update data:", JSON.stringify(data, null, 2));

      const updated = (await this.delegate.update({
        where: { id: eventId },
        data,
        include: this.includeConfig,
      })) as unknown as CalendarEventWithRelations;

      // Send emails to external participants if they were updated
      if (payload.externalParticipants !== undefined) {
        const creator = await prisma.user.findUnique({
          where: { id: userId },
          select: { fullNames: true },
        });
        if (!creator) {
          throw new AppError("Creator not found", 404);
        }
        const organizerName = creator.fullNames;

        const existingEmails = existing.externalParticipants.map(
          (ep) => ep.email,
        );
        const newEmails = payload.externalParticipants.map((p) =>
          typeof p === "string" ? p : p.email,
        );
        const removedEmails = existingEmails.filter(
          (email) => !newEmails.includes(email),
        );

        const promises = [];

        // Send cancellations to removed participants
        for (const email of removedEmails) {
          promises.push(
            CalendarEmailService.sendMeetingCancellation({
              title: updated.title,
              description: updated.description || undefined,
              startTime: updated.startAt,
              endTime: updated.endAt || undefined,
              location: updated.location || undefined,
              meetingType: updated.meetingType || "EBUMENYI_MEETING",
              hostEmail: updated.hostEmail || undefined,
              participantEmail: email,
              organizerName,
              timezone: updated.timezone,
            }).catch((error) =>
              console.error(`Failed to send cancellation to ${email}:`, error),
            ),
          );
        }

        // Send updates to kept or added participants
        for (const email of newEmails) {
          promises.push(
            CalendarEmailService.sendMeetingUpdate({
              title: updated.title,
              description: updated.description || undefined,
              startTime: updated.startAt,
              endTime: updated.endAt || undefined,
              location: updated.location || undefined,
              meetingType: updated.meetingType || "EBUMENYI_MEETING",
              hostEmail: updated.hostEmail || undefined,
              participantEmail: email,
              organizerName,
              timezone: updated.timezone,
              changes: ["Meeting details updated"],
            }).catch((error) =>
              console.error(`Failed to send update to ${email}:`, error),
            ),
          );
        }

        await Promise.allSettled(promises);
      }

      // Send notifications to internal participants about the update
      const notificationPromises = [];
      for (const participant of updated.participants) {
        if (participant.userId !== userId) {
          notificationPromises.push(
            NotificationService.createNotification(
              participant.userId,
              `${updated.title}`,
              updated.description ?? "Ikiganiro gisukiranywe",
              "info",
              `/calendar/${updated.id}`,
              "calendar_event",
              updated.id,
              {
                eventType: updated.type,
                meetingType: updated.meetingType,
                startTime: updated.startAt,
                location: updated.location,
                timezone: updated.timezone,
              },
              {
                cooldownMs: 300_000, // 5 minutes
                dedupKey: `calendar:${updated.id}:updated:${participant.userId}`,
              },
            )
              .then(async (notification) => {
                if (io) {
                  console.log(
                    "[SOCKET EMIT] Broadcasting notification for event update:",
                    updated.id,
                    "to user:",
                    participant.userId,
                  );
                  const userRoom = `user:${participant.userId}`;
                  const unreadCount = await NotificationService.getUnreadCount(
                    participant.userId,
                  );
                  io.to(userRoom).emit("notification", notification);
                  io.to(userRoom).emit("unread_count_updated", { unreadCount });
                }
              })
              .catch((error) =>
                console.error(`Failed to notify ${participant.userId}:`, error),
              ),
          );
        }
      }

      // Ping the updater's socket for data sync (they're excluded from participant notifications)
      if (io) {
        io.to(`user:${userId}`).emit("calendar_data_changed", {
          eventId: updated.id,
          action: "updated",
        });
      }

      console.log(
        "[CALENDAR EVENT] Waiting for all notifications to complete...",
      );
      await Promise.allSettled(notificationPromises);
      console.log("[CALENDAR EVENT] Event updated successfully:", updated.id);

      // Re-expand recurring events into individual instances
      if (updated.frequency && updated.frequency !== "NONE") {
        this.expandEventIntoInstances(updated.id).catch((error) => {
          console.error("Failed to re-expand event instances:", error);
        });
      }

      return {
        message: "Event updated successfully",
        statusCode: 200,
        data: await this.buildResponseEvent(updated, userId),
      };
    } catch (error) {
      console.error("Error in updateEvent:", error);
      throw error;
    }
  }

  public static async deleteEvent(userId: string, eventId: string, io?: any) {
    console.log(
      "[CALENDAR EVENT] Deleting event:",
      eventId,
      "by user:",
      userId,
    );
    console.log("[CALENDAR EVENT] Socket IO instance available:", !!io);
    const existing = (await this.delegate.findUnique({
      where: { id: eventId },
      include: this.includeConfig,
    })) as unknown as CalendarEventWithRelations | null;

    if (!existing) {
      throw new AppError("Event not found", 404);
    }

    if (existing.createdById !== userId) {
      throw new AppError("You are not allowed to delete this event", 403);
    }

    // Send notifications to internal participants about cancellation
    console.log(
      "[CALENDAR EVENT] Sending deletion notifications to",
      existing.participants.length,
      "participants",
    );
    const notificationPromises = [];
    for (const participant of existing.participants) {
      if (participant.userId !== userId) {
        console.log(
          "[CALENDAR EVENT] Notifying participant of deletion:",
          participant.userId,
        );
        notificationPromises.push(
          NotificationService.createNotification(
            participant.userId,
            `${existing.title}`,
            existing.description ?? "Ikiganiro gisukiranywe",
            "warning",
            `/calendar/${existing.id}`,
            "calendar_event",
            existing.id,
            {
              eventType: existing.type,
              meetingType: existing.meetingType,
              timezone: existing.timezone,
            },
            {
              cooldownMs: 300_000, // 5 minutes
              dedupKey: `calendar:${existing.id}:deleted:${participant.userId}`,
            },
          )
            .then(async (notification) => {
              if (io) {
                console.log(
                  "[SOCKET EMIT] Broadcasting deletion notification for event:",
                  existing.id,
                  "to user:",
                  participant.userId,
                );
                const userRoom = `user:${participant.userId}`;
                const unreadCount = await NotificationService.getUnreadCount(
                  participant.userId,
                );
                io.to(userRoom).emit("notification", notification);
                io.to(userRoom).emit("unread_count_updated", { unreadCount });
              }
            })
            .catch((error) =>
              console.error(`Failed to notify ${participant.userId}:`, error),
            ),
        );
      }
    }

    // Ping the deleter's socket for data sync
    if (io && userId) {
      io.to(`user:${userId}`).emit("calendar_data_changed", {
        eventId: existing.id,
        action: "deleted",
      });
    }

    console.log(
      "[CALENDAR EVENT] Waiting for all deletion notifications to complete...",
    );
    await Promise.allSettled(notificationPromises);
    console.log("[CALENDAR EVENT] Deleting event from database:", eventId);

    await this.delegate.delete({ where: { id: eventId } });
    console.log("[CALENDAR EVENT] Event deleted successfully:", eventId);

    return {
      message: "Event deleted successfully",
      statusCode: 200,
    };
  }

  /**
   * Update occurrence(s) - handles single, future, or all occurrences
   * @param mode - "single": update only this occurrence
   *               "future": update this and all future occurrences
   *               "all": update all occurrences in the series
   */
  public static async updateOccurrence(
    userId: string,
    eventId: string,
    payload: UpdateCalendarEventDto,
    mode: "single" | "all" | "future" = "single",
  ) {
    try {
      // Get the target event
      const targetEvent = (await this.delegate.findUnique({
        where: { id: eventId },
        include: this.includeConfig,
      })) as unknown as CalendarEventWithRelations | null;

      if (!targetEvent) {
        throw new AppError("Event not found", 404);
      }

      if (!this.userCanAccessEvent(userId, targetEvent)) {
        throw new AppError("You are not allowed to update this event", 403);
      }

      // Mode 1: Update single occurrence only
      if (mode === "single") {
        const data = this.buildUpdateData(targetEvent, payload);
        const updated = (await this.delegate.update({
          where: { id: eventId },
          data,
          include: this.includeConfig,
        })) as unknown as CalendarEventWithRelations;

        console.log(
          `[CALENDAR EVENT] Updated single occurrence ${eventId} with commonId: ${targetEvent.commonId}`,
        );

        return {
          message: "Occurrence updated successfully",
          statusCode: 200,
          data: await this.buildResponseEvent(updated, userId),
        };
      }

      // For future and all modes, check if it's a recurring event
      if (!targetEvent.isRepeating || !targetEvent.commonId) {
        // If not recurring, just update this single event
        const data = this.buildUpdateData(targetEvent, payload);
        const updated = (await this.delegate.update({
          where: { id: eventId },
          data,
          include: this.includeConfig,
        })) as unknown as CalendarEventWithRelations;

        return {
          message: "Event updated successfully",
          statusCode: 200,
          data: await this.buildResponseEvent(updated, userId),
        };
      }

      // Mode 2: Update all occurrences in the series
      if (mode === "all") {
        // Validate that commonId exists (required for series operations)
        if (!targetEvent.commonId) {
          throw new AppError(
            "Cannot update all occurrences: event is not part of a recurring series",
            400,
          );
        }

        // For "all" mode: Calculate time offset and apply to all occurrences
        // This preserves each event's date while updating the time
        let startTimeOffsetMs = 0;
        let endTimeOffsetMs = 0;

        if (payload.startAt !== undefined) {
          const newStartTime = this.parseDate(payload.startAt, "startAt");
          const existingStartTime = new Date(targetEvent.startAt);
          startTimeOffsetMs =
            newStartTime.getTime() - existingStartTime.getTime();
        }

        if (payload.endAt !== undefined && payload.endAt !== null) {
          const newEndTime = this.parseDate(payload.endAt, "endAt");
          const existingEndTime = new Date(
            targetEvent.endAt || targetEvent.startAt,
          );
          endTimeOffsetMs = newEndTime.getTime() - existingEndTime.getTime();
        }

        // Create a payload without date fields (we'll handle dates specially)
        const payloadWithoutDates = { ...payload };
        delete payloadWithoutDates.startAt;
        delete payloadWithoutDates.endAt;

        const data = this.buildUpdateDataForMany(
          targetEvent,
          payloadWithoutDates,
        );

        // For all/future modes with date updates: get all occurrences first, then update with offset
        if (startTimeOffsetMs !== 0 || endTimeOffsetMs !== 0) {
          // Get all occurrences in the series
          const allOccurrences = await this.delegate.findMany({
            where: { commonId: targetEvent.commonId } as any,
          });

          // Update each occurrence with the time offset
          const updatePromises = allOccurrences.map((occurrence) => {
            const updateData: any = { ...data };

            if (startTimeOffsetMs !== 0) {
              const newStart = new Date(occurrence.startAt);
              newStart.setTime(newStart.getTime() + startTimeOffsetMs);
              updateData.startAt = newStart;
            }

            if (endTimeOffsetMs !== 0) {
              const newEnd = new Date(occurrence.endAt || occurrence.startAt);
              newEnd.setTime(newEnd.getTime() + endTimeOffsetMs);
              updateData.endAt = newEnd;
            }

            return this.delegate.update({
              where: { id: occurrence.id },
              data: updateData,
            });
          });

          await Promise.all(updatePromises);
        } else {
          // No date offset, just update scalar fields
          await this.delegate.updateMany({
            where: { commonId: targetEvent.commonId } as any,
            data,
          });
        }

        console.log(
          `[CALENDAR EVENT] Updated ALL occurrences in series with commonId: ${targetEvent.commonId}`,
        );

        // Smart expand/cleanup if recurrenceEndsAt changed
        if (payload.recurrenceEndsAt !== undefined) {
          const updatedTemplateEvent = (await this.delegate.findUnique({
            where: { id: eventId },
            include: this.includeConfig,
          })) as unknown as CalendarEventWithRelations;
          await this.smartExpandAndCleanupSeries(
            targetEvent.commonId,
            updatedTemplateEvent,
          );
        }

        // Handle nested relations separately if provided
        if (
          payload.participants !== undefined ||
          payload.externalParticipants !== undefined ||
          payload.attachments !== undefined
        ) {
          try {
            await this.updateNestedRelationsForEvents(
              payload,
              targetEvent.commonId,
              undefined,
              targetEvent.createdById,
            );
          } catch (nestedError) {
            console.error(
              `[CALENDAR EVENT] Warning: Failed to update nested relations for series ${targetEvent.commonId}:`,
              nestedError,
            );
          }
        }

        // Return all updated events
        const result = await this.delegate.findMany({
          where: { commonId: targetEvent.commonId } as any,
          include: this.includeConfig,
          orderBy: { startAt: "asc" },
        });

        return {
          message: `Updated all occurrences in series`,
          statusCode: 200,
          data: await this.buildResponseEvents(
            result as unknown as CalendarEventWithRelations[],
            userId,
          ),
        };
      }

      // Mode 3: Update this and all future occurrences
      if (mode === "future") {
        // Validate that commonId exists (required for series operations)
        if (!targetEvent.commonId) {
          throw new AppError(
            "Cannot update future occurrences: event is not part of a recurring series",
            400,
          );
        }

        // For "future" mode: Calculate time offset and apply to future occurrences
        let startTimeOffsetMs = 0;
        let endTimeOffsetMs = 0;

        if (payload.startAt !== undefined) {
          const newStartTime = this.parseDate(payload.startAt, "startAt");
          const existingStartTime = new Date(targetEvent.startAt);
          startTimeOffsetMs =
            newStartTime.getTime() - existingStartTime.getTime();
        }

        if (payload.endAt !== undefined && payload.endAt !== null) {
          const newEndTime = this.parseDate(payload.endAt, "endAt");
          const existingEndTime = new Date(
            targetEvent.endAt || targetEvent.startAt,
          );
          endTimeOffsetMs = newEndTime.getTime() - existingEndTime.getTime();
        }

        // Create a payload without date fields
        const payloadWithoutDates = { ...payload };
        delete payloadWithoutDates.startAt;
        delete payloadWithoutDates.endAt;

        const data = this.buildUpdateDataForMany(
          targetEvent,
          payloadWithoutDates,
        );

        // For future mode with date updates: get future occurrences, then update with offset
        if (startTimeOffsetMs !== 0 || endTimeOffsetMs !== 0) {
          // Get all future occurrences
          const futureOccurrences = await this.delegate.findMany({
            where: {
              commonId: targetEvent.commonId,
              startAt: { gte: targetEvent.startAt },
            } as any,
          });

          // Update each future occurrence with the time offset
          const updatePromises = futureOccurrences.map((occurrence) => {
            const updateData: any = { ...data };

            if (startTimeOffsetMs !== 0) {
              const newStart = new Date(occurrence.startAt);
              newStart.setTime(newStart.getTime() + startTimeOffsetMs);
              updateData.startAt = newStart;
            }

            if (endTimeOffsetMs !== 0) {
              const newEnd = new Date(occurrence.endAt || occurrence.startAt);
              newEnd.setTime(newEnd.getTime() + endTimeOffsetMs);
              updateData.endAt = newEnd;
            }

            return this.delegate.update({
              where: { id: occurrence.id },
              data: updateData,
            });
          });

          await Promise.all(updatePromises);
        } else {
          // No date offset, just update scalar fields
          await this.delegate.updateMany({
            where: {
              commonId: targetEvent.commonId,
              startAt: { gte: targetEvent.startAt },
            } as any,
            data,
          });
        }

        console.log(
          `[CALENDAR EVENT] Updated future occurrences in series with commonId: ${targetEvent.commonId}`,
        );

        // Smart expand/cleanup if recurrenceEndsAt changed
        if (payload.recurrenceEndsAt !== undefined) {
          const updatedTemplateEvent = (await this.delegate.findUnique({
            where: { id: eventId },
            include: this.includeConfig,
          })) as unknown as CalendarEventWithRelations;
          await this.smartExpandAndCleanupSeries(
            targetEvent.commonId,
            updatedTemplateEvent,
          );
        }

        // Handle nested relations separately if provided
        if (
          payload.participants !== undefined ||
          payload.externalParticipants !== undefined ||
          payload.attachments !== undefined
        ) {
          try {
            await this.updateNestedRelationsForEvents(
              payload,
              targetEvent.commonId,
              { gte: targetEvent.startAt },
              targetEvent.createdById,
            );
          } catch (nestedError) {
            console.error(
              `[CALENDAR EVENT] Warning: Failed to update nested relations for future occurrences in series ${targetEvent.commonId}:`,
              nestedError,
            );
          }
        }

        // Return all updated events
        const result = await this.delegate.findMany({
          where: {
            commonId: targetEvent.commonId,
            startAt: { gte: targetEvent.startAt },
          } as any,
          include: this.includeConfig,
          orderBy: { startAt: "asc" },
        });

        return {
          message: "This and all future occurrences updated successfully",
          statusCode: 200,
          data: await this.buildResponseEvents(
            result as unknown as CalendarEventWithRelations[],
            userId,
          ),
        };
      }

      throw new AppError("Invalid mode parameter", 400);
    } catch (error) {
      console.error("[CALENDAR EVENT] Error in updateOccurrence:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Error updating occurrence: ${error instanceof Error ? error.message : "Unknown error"}`,
        500,
      );
    }
  }

  /**
   * Update a specific occurrence only
   * Updates this single instance without affecting the series or other occurrences
   * Uses commonId to identify the series, but only updates this one event
   */
  public static async updateOccurrenceOnly(
    userId: string,
    eventId: string,
    updates: { title?: string; description?: string; location?: string | null },
  ) {
    // eventId is the specific CalendarEvent record to update
    const event = (await this.delegate.findUnique({
      where: { id: eventId },
      include: this.includeConfig,
    })) as unknown as CalendarEventWithRelations | null;

    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (!this.userCanAccessEvent(userId, event)) {
      throw new AppError("You are not allowed to modify this event", 403);
    }

    // Build update data - update fields directly
    const data: any = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined)
      data.description = updates.description;
    if (updates.location !== undefined) data.location = updates.location;

    const updated = (await this.delegate.update({
      where: { id: eventId },
      data,
      include: this.includeConfig,
    })) as unknown as CalendarEventWithRelations;

    console.log(
      `[CALENDAR EVENT] Updated single occurrence ${eventId} with commonId: ${event.commonId}`,
    );

    return {
      message: "Occurrence updated successfully",
      statusCode: 200,
      data: await this.buildResponseEvent(updated, userId),
    };
  }

  /**
   * Update this occurrence and all future occurrences
   * Uses commonId to find all instances and date >= this occurrence
   * Updates fields directly on all matching events
   */
  public static async updateFutureOccurrences(
    userId: string,
    eventId: string,
    payload: UpdateCalendarEventDto,
  ) {
    // Get the target event
    const targetEvent = (await this.delegate.findUnique({
      where: { id: eventId },
      include: this.includeConfig,
    })) as unknown as CalendarEventWithRelations | null;

    if (!targetEvent) {
      throw new AppError("Event not found", 404);
    }

    if (!this.userCanAccessEvent(userId, targetEvent)) {
      throw new AppError("You are not allowed to update this event", 403);
    }

    // If not a recurring event, just update this one
    if (!targetEvent.isRepeating || !targetEvent.commonId) {
      return await this.updateOccurrenceOnly(userId, eventId, {
        title: payload.title,
        description: payload.description,
        location: payload.location,
      });
    }

    // Update all occurrences from this date forward with same commonId
    const updated = await this.delegate.updateMany({
      where: {
        commonId: targetEvent.commonId,
        startAt: { gte: targetEvent.startAt },
      } as any,
      data: {
        titleOverride: payload.title || null,
        descriptionOverride: payload.description || null,
        locationOverride: payload.location || null,
      } as any,
    });

    console.log(
      `[CALENDAR EVENT] Updated ${updated.count} future occurrences with commonId: ${targetEvent.commonId}`,
    );

    // Return all updated events
    const result = await this.delegate.findMany({
      where: {
        commonId: targetEvent.commonId,
        startAt: { gte: targetEvent.startAt },
      } as any,
      include: this.includeConfig,
      orderBy: { startAt: "asc" },
    });

    return {
      message: "Future occurrences updated successfully",
      statusCode: 200,
      data: await this.buildResponseEvents(
        result as unknown as CalendarEventWithRelations[],
        userId,
      ),
    };
  }

  /**
   * Delete occurrence(s) - permanently removes events from database
   * @param mode - "single": delete only this occurrence
   *               "all": delete all occurrences in series (using commonId)
   *               "future": delete this occurrence and all future occurrences
   */
  public static async cancelOccurrence(
    userId: string,
    eventId: string,
    mode: "single" | "all" | "future" = "single",
  ) {
    const event = (await this.delegate.findUnique({
      where: { id: eventId },
      include: this.includeConfig,
    })) as unknown as CalendarEventWithRelations | null;

    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (!this.userCanAccessEvent(userId, event)) {
      throw new AppError("You are not allowed to modify this event", 403);
    }

    // Mode 1: Delete ALL occurrences in the series (if commonId exists)
    if (mode === "all" && event.commonId) {
      const deleted = await this.delegate.deleteMany({
        where: { commonId: event.commonId } as any,
      });

      console.log(
        `[CALENDAR EVENT] Permanently deleted ALL ${deleted.count} occurrences in series with commonId: ${event.commonId}`,
      );

      return {
        message: `Permanently deleted all ${deleted.count} occurrences in series`,
        statusCode: 200,
        data: null,
      };
    }

    // Mode 2: Delete this occurrence and all future occurrences
    if (mode === "future" && event.commonId) {
      const deleted = await this.delegate.deleteMany({
        where: {
          commonId: event.commonId,
          startAt: { gte: event.startAt },
        } as any,
      });

      console.log(
        `[CALENDAR EVENT] Permanently deleted ${deleted.count} occurrences (this and future) in series with commonId: ${event.commonId}`,
      );

      return {
        message: `Permanently deleted this and ${deleted.count - 1} future occurrences`,
        statusCode: 200,
        data: null,
      };
    }

    // Mode 3: Delete only this single occurrence
    await this.delegate.delete({
      where: { id: eventId },
    });

    console.log(
      `[CALENDAR EVENT] Permanently deleted single occurrence ${eventId} with commonId: ${event.commonId}`,
    );

    return {
      message: "Occurrence permanently deleted successfully",
      statusCode: 200,
      data: null,
    };
  }

  /**
   * Update nested relations (participants, externalParticipants, attachments) for multiple events
   * Called separately after updateMany since nested writes aren't supported in bulk updates
   */
  private static async updateNestedRelationsForEvents(
    payload: UpdateCalendarEventDto,
    commonId: string,
    startAtFilter?: { gte?: Date; gt?: Date },
    createdById?: string,
  ): Promise<void> {
    try {
      // If no nested updates are requested, skip
      if (
        payload.participants === undefined &&
        payload.externalParticipants === undefined &&
        payload.attachments === undefined
      ) {
        return;
      }

      // Fetch affected events
      const where: Record<string, any> = { commonId };
      if (startAtFilter) {
        where.startAt = startAtFilter;
      }

      const events = await this.delegate.findMany({
        where,
      });

      if (events.length === 0) {
        console.warn(
          `[CALENDAR EVENT] No events found with commonId: ${commonId} for updating nested relations`,
        );
        return;
      }

      console.log(
        `[CALENDAR EVENT] Updating nested relations for ${events.length} events with commonId: ${commonId}`,
      );

      // Update each event's nested relations
      // NOTE: We update each event separately to ensure all succeed or all fail for that event
      // This prevents partial updates where participants are deleted but not recreated
      const updatePromises = events.map(async (event) => {
        const transactionOperations: any[] = [];

        try {
          if (payload.participants !== undefined) {
            const participantData = payload.participants.map((p) => ({
              userId: p.userId,
            }));
            // Add organizer if not already in the list
            if (createdById) {
              const organizerExists = participantData.some(
                (p) => p.userId === createdById,
              );
              if (!organizerExists) {
                participantData.push({
                  userId: createdById,
                });
              }
            }

            // Delete existing and create new participants (atomic transaction)
            transactionOperations.push(
              (prisma as any).calendarEventParticipant.deleteMany({
                where: { calendarEventId: event.id },
              }),
            );
            transactionOperations.push(
              (prisma as any).calendarEventParticipant.createMany({
                data: participantData.map((p) => ({
                  ...p,
                  calendarEventId: event.id,
                })),
              }),
            );
          }

          if (payload.externalParticipants !== undefined) {
            const externalData = payload.externalParticipants.map((p) =>
              typeof p === "string"
                ? { email: p, name: null }
                : {
                    email: p.email,
                    name: p.name || null,
                  },
            );

            // Delete existing and create new external participants (atomic transaction)
            transactionOperations.push(
              (prisma as any).calendarExternalParticipant.deleteMany({
                where: { calendarEventId: event.id },
              }),
            );
            transactionOperations.push(
              (prisma as any).calendarExternalParticipant.createMany({
                data: externalData.map((p) => ({
                  ...p,
                  calendarEventId: event.id,
                })),
              }),
            );
          }

          if (payload.attachments !== undefined) {
            const attachmentData = payload.attachments
              .filter((a) => a?.url)
              .map((a) => ({
                name: this.resolveAttachmentName(a),
                url: a.url,
              }));

            // Delete existing and create new attachments (atomic transaction)
            transactionOperations.push(
              (prisma as any).calendarAttachment.deleteMany({
                where: { calendarEventId: event.id },
              }),
            );
            transactionOperations.push(
              (prisma as any).calendarAttachment.createMany({
                data: attachmentData.map((a) => ({
                  ...a,
                  calendarEventId: event.id,
                })),
              }),
            );
          }

          // Execute all operations for this event in a single transaction
          if (transactionOperations.length > 0) {
            await (prisma as any).$transaction(transactionOperations);
            console.log(
              `[CALENDAR EVENT] Successfully updated nested relations for event ${event.id}`,
            );
          }
        } catch (error) {
          console.error(
            `[CALENDAR EVENT] ⚠️  Error updating nested relations for event ${event.id}:`,
            error,
          );
          // Log the error and continue with other events
          // This ensures partial success if multiple events need updating
          throw error;
        }
      });

      // Execute all updates in parallel
      const results = await Promise.allSettled(updatePromises);

      // Check for failures
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.error(
          `[CALENDAR EVENT] ⚠️  Failed to update nested relations for ${failures.length}/${events.length} events`,
        );
        // If any updates failed, we might want to alert operations or queue a retry
        // For now, we log but don't throw so the main update still shows as successful
      }

      if (failures.length === results.length) {
        throw new Error(
          `Failed to update nested relations for all ${events.length} events`,
        );
      }
    } catch (error) {
      console.error(
        "[CALENDAR EVENT] ⚠️  Error updating nested relations for events:",
        error,
      );
      // Re-throw so caller knows this operation failed
      throw error;
    }
  }

  /**
   * Build update data for updateMany operations (excludes nested relations)
   * Used for bulk updates where nested writes aren't supported
   * NOTE: For startAt/endAt - only updates the TIME portion, preserves each occurrence's DATE
   * This ensures each event keeps its unique date but can have time adjusted
   */
  private static buildUpdateDataForMany(
    existing: CalendarEventWithRelations,
    payload: UpdateCalendarEventDto,
  ) {
    const data: Record<string, unknown> = {};

    if (payload.title !== undefined) {
      data.title = payload.title;
    }

    if (payload.description !== undefined) {
      data.description = payload.description ?? null;
    }

    if (payload.type !== undefined) {
      data.type = this.normalizeType(payload.type);
    }

    const nextFrequency = this.normalizeFrequency(
      payload.frequency ?? (existing.frequency as CalendarFrequency),
    );

    const nextDaysOfWeek = this.normalizeDaysOfWeek(
      payload.daysOfWeek ?? existing.daysOfWeek,
      nextFrequency,
    );

    data.frequency = nextFrequency;
    data.daysOfWeek = nextDaysOfWeek;

    if (payload.timezone !== undefined) {
      data.timezone = payload.timezone.trim() || DEFAULT_TIMEZONE;
    }

    // For startAt/endAt: extract time only and preserve each occurrence's date
    if (payload.startAt !== undefined) {
      const newStartTime = this.parseDate(payload.startAt, "startAt");
      const existingStartDate = new Date(existing.startAt);

      // Keep existing date, update time
      existingStartDate.setHours(
        newStartTime.getHours(),
        newStartTime.getMinutes(),
        newStartTime.getSeconds(),
        newStartTime.getMilliseconds(),
      );
      data.startAt = existingStartDate;
    }

    if (payload.endAt !== undefined && payload.endAt !== null) {
      const newEndTime = this.parseDate(payload.endAt, "endAt");
      const existingEndDate = new Date(existing.endAt || existing.startAt);

      // Keep existing date, update time
      existingEndDate.setHours(
        newEndTime.getHours(),
        newEndTime.getMinutes(),
        newEndTime.getSeconds(),
        newEndTime.getMilliseconds(),
      );
      data.endAt = existingEndDate;
    } else if (payload.endAt === null) {
      data.endAt = null;
    }

    if (payload.allDay !== undefined) {
      data.allDay = payload.allDay;
    }

    if (payload.reminderMinutesBefore !== undefined) {
      data.reminderMinutesBefore = this.normalizeReminder(
        payload.reminderMinutesBefore,
      );
    }

    if (payload.recurrenceEndsAt !== undefined) {
      data.recurrenceEndsAt = payload.recurrenceEndsAt
        ? this.parseDate(payload.recurrenceEndsAt, "recurrenceEndsAt")
        : null;
    }

    if (payload.meetingType !== undefined) {
      data.meetingType = this.normalizeMeetingType(payload.meetingType);
    }

    if (payload.location !== undefined) {
      data.location = payload.location ?? null;
      if (
        payload.streamRoomId === undefined &&
        payload.location &&
        /\/meeting\//i.test(payload.location)
      ) {
        const match = payload.location.match(/\/meeting\/([^/?#]+)/i);
        if (match?.[1]) {
          data.streamRoomId = match[1];
        }
      }
    }

    if (payload.streamRoomId !== undefined) {
      data.streamRoomId = payload.streamRoomId ?? null;
    }

    if (payload.priority !== undefined) {
      if (payload.priority && payload.priority.trim()) {
        data.priority = this.normalizePriority(payload.priority);
      }
    }

    if (payload.hostEmail !== undefined) {
      data.hostEmail = payload.hostEmail ?? null;
    }

    // NOTE: Do NOT include nested relations here (participants, externalParticipants, attachments)
    // updateMany() doesn't support nested writes - these must be handled separately

    return data;
  }

  /**
   * Build update data including nested relations
   * Used for single update operations where nested writes are supported
   */
  private static buildUpdateData(
    existing: CalendarEventWithRelations,
    payload: UpdateCalendarEventDto,
  ) {
    // Start with the scalar fields
    const data: Record<string, unknown> = this.buildUpdateDataForMany(
      existing,
      payload,
    );

    // Add nested relations (only for single updates, not for updateMany)
    if (payload.participants !== undefined) {
      const participantData = payload.participants.map((p) => ({
        userId: p.userId,
      }));
      // Add organizer if not already in the list
      const organizerExists = participantData.some(
        (p) => p.userId === existing.createdById,
      );
      if (!organizerExists) {
        participantData.push({
          userId: existing.createdById,
        });
      }
      data.participants = {
        deleteMany: {},
        createMany: { data: participantData },
      };
    }

    if (payload.externalParticipants !== undefined) {
      const externalData = payload.externalParticipants.map((p) =>
        typeof p === "string"
          ? { email: p, name: null }
          : {
              email: p.email,
              name: p.name || null,
            },
      );
      data.externalParticipants = {
        deleteMany: {},
        createMany: { data: externalData },
      };
    }

    if (payload.attachments !== undefined) {
      const attachmentData = payload.attachments
        .filter((a) => a?.url)
        .map((a) => ({
          name: this.resolveAttachmentName(a),
          url: a.url,
        }));
      data.attachments = {
        deleteMany: {},
        createMany: { data: attachmentData },
      };
    }

    return data;
  }

  private static normalizeFrequency(
    value: CalendarFrequency,
  ): CalendarFrequency {
    const upper = value.toUpperCase() as CalendarFrequency;
    const allowed: CalendarFrequency[] = ["NONE", "DAILY", "WEEKLY", "MONTHLY"];
    if (!allowed.includes(upper)) {
      throw new AppError("Invalid frequency value", 400);
    }
    return upper;
  }

  private static normalizeType(value: CalendarEventType): CalendarEventType {
    const upper = value.toUpperCase() as CalendarEventType;
    const allowed: CalendarEventType[] = [
      "TRAINING",
      "REMINDER",
      "DEADLINE",
      "CUSTOM",
      "WEBINAR",
      "MEETING",
      "SCREENING",
      "DRILL",
    ];
    if (!allowed.includes(upper)) {
      throw new AppError("Invalid event type", 400);
    }
    return upper;
  }

  private static normalizeMeetingType(value: MeetingType): MeetingType {
    const upper = value.toUpperCase().replace(/-/g, "_") as MeetingType;
    const allowed: MeetingType[] = [
      "EBUMENYI_MEETING",
      "GOOGLE_MEET",
      "ZOOM",
      "OTHER",
    ];
    if (!allowed.includes(upper)) {
      throw new AppError("Invalid meeting type", 400);
    }
    return upper;
  }

  /**
   * Derive a friendly attachment name.
   * Order: explicit name -> originalName -> filename from URL (without query/extension).
   */
  private static resolveAttachmentName(input: {
    name?: string;
    originalName?: string;
    url: string;
  }): string {
    if (input.name && input.name.trim()) return input.name.trim();
    if (input.originalName && input.originalName.trim())
      return input.originalName.trim();

    const cleanUrl = (input.url || "").split("?")[0];
    const lastSegment = cleanUrl.split("/").filter(Boolean).pop() || cleanUrl;
    const withoutExt = lastSegment.replace(/\.[^/.]+$/, "");
    const maybeDouble = withoutExt.replace(/\.[^/.]+$/, "");
    const fallback = (withoutExt || maybeDouble || "Attachment").trim();
    return fallback || "Attachment";
  }

  private static normalizePriority(value: string): EventPriority {
    const upper = value.toUpperCase() as EventPriority;
    const allowed: EventPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (!allowed.includes(upper)) {
      throw new AppError("Invalid priority", 400);
    }
    return upper;
  }

  private static normalizeDaysOfWeek(
    days: number[] | undefined,
    frequency: CalendarFrequency,
  ): number[] {
    if (frequency !== "WEEKLY") {
      return [];
    }

    if (!days || days.length === 0) {
      throw new AppError(
        "daysOfWeek must be provided for weekly frequency",
        400,
      );
    }

    const normalized = Array.from(new Set(days.map((day) => Number(day)))).sort(
      (a, b) => a - b,
    );

    normalized.forEach((day) => {
      if (Number.isNaN(day) || day < 0 || day > 6) {
        throw new AppError(
          "daysOfWeek must contain values between 0 and 6",
          400,
        );
      }
    });

    return normalized;
  }

  private static normalizeReminder(
    value: number | number[] | null | undefined,
  ) {
    if (value === undefined || value === null) {
      return [DEFAULT_REMINDER_MINUTES];
    }

    const list = Array.isArray(value) ? value : [value];
    list.forEach((v) => {
      if (v < 0) {
        throw new AppError("reminderMinutesBefore must be >= 0", 400);
      }
    });
    const uniqueSorted = Array.from(new Set(list)).sort((a, b) => a - b);
    return uniqueSorted;
  }

  private static parseDate(input: string, field: string) {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      throw new AppError(`Invalid date provided for ${field}`, 400);
    }
    return date;
  }

  private static userCanAccessEvent(
    userId: string,
    event: CalendarEventWithRelations,
  ) {
    if (event.createdById === userId) {
      return true;
    }

    return event.participants.some(
      (participant) => participant.userId === userId,
    );
  }

  private static transformEvent(
    event: CalendarEventWithRelations,
    currentUserId?: string,
  ): CalendarEventResponse {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      type: event.type as CalendarEventType,
      frequency: event.frequency as CalendarFrequency,
      daysOfWeek: event.daysOfWeek ?? [],
      timezone: event.timezone,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt ? event.endAt.toISOString() : null,
      allDay: event.allDay,
      reminderMinutesBefore: event.reminderMinutesBefore,
      recurrenceEndsAt: event.recurrenceEndsAt
        ? event.recurrenceEndsAt.toISOString()
        : null,
      meetingType: event.meetingType,
      location: event.location,
      streamRoomId: event.streamRoomId ?? null,
      priority: event.priority as EventPriority,
      hostEmail: event.hostEmail,
      createdById: event.createdById,
      isRepeating: event.isRepeating,
      commonId: event.commonId,
      isCancelled: event.isCancelled,
      amOwner: currentUserId === event.createdById,
      participants: event.participants.map(
        (participant: ParticipantWithUser) => ({
          id: participant.id,
          userId: participant.userId,
          user: participant.user
            ? {
                id: participant.user.id,
                fullNames: participant.user.fullNames,
                email: participant.user.email ?? null,
                phoneNumber: participant.user.phoneNumber,
              }
            : undefined,
        }),
      ),
      externalParticipants: event.externalParticipants.map(
        (participant: ExternalParticipant) => ({
          id: participant.id,
          email: participant.email,
          name: participant.name,
        }),
      ),
      attachments: event.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        url: attachment.url,
      })),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  private static async loadUsersByIds(
    userIds: string[],
  ): Promise<Map<string, UserPreview>> {
    const uniqueIds = [...new Set(userIds)].filter(Boolean);
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const users = (await prisma.user.findMany({
      where: {
        id: {
          in: uniqueIds,
        },
      },
      select: this.participantUserSelect,
    })) as UserPreview[];

    return new Map(users.map((user) => [user.id, user]));
  }

  private static async hydrateEventParticipants(
    event: CalendarEventWithRelations,
    userMap: Map<string, UserPreview>,
  ): Promise<CalendarEventWithRelations> {
    return {
      ...event,
      participants: event.participants.map((participant) => ({
        ...participant,
        user: userMap.get(participant.userId),
      })),
    };
  }

  private static async buildResponseEvent(
    event: CalendarEventWithRelations,
    currentUserId?: string,
  ): Promise<CalendarEventResponse> {
    const [response] = await this.buildResponseEvents([event], currentUserId);
    return response;
  }

  private static async buildResponseEvents(
    events: CalendarEventWithRelations[],
    currentUserId?: string,
  ): Promise<CalendarEventResponse[]> {
    const userMap = await this.loadUsersByIds(
      events.flatMap((event) =>
        event.participants.map((participant) => participant.userId),
      ),
    );

    const hydratedEvents = await Promise.all(
      events.map((event) => this.hydrateEventParticipants(event, userMap)),
    );

    return hydratedEvents.map((event) =>
      this.transformEvent(event, currentUserId),
    );
  }
}
