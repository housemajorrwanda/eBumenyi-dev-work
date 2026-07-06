/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Video,
  Plus,
  Search,
  Bell,
  AlertCircle,
  CheckCircle,
  Edit,
  Trash2,
  Eye,
  Copy,
  GraduationCap,
  ClipboardCheck,
  FileText,
} from "lucide-react";
import ComboboxField from "@/components/common/form/ComboboxField";
import OptionsField from "@/components/common/form/OptionsField";
import TextField from "@/components/common/form/TextField";
import TextArea from "@/components/common/form/TextArea";
import Button from "@/components/common/form/Button";
import { getAllUsersNopagination } from "@/services/users.api";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  cancelOccurrence,
  updateOccurrence,
} from "@/services/calender.service";
import { useAuth } from "@/hooks/useAuth";
import { uploadFileByType } from "@/services/uploader.api";
import { getPublicHospitals } from "@/services/hospitals.service";

const EBUMENYI_SCHEDULE_URL =
  import.meta.env.VITE_EBUMENYI_MEET_API_URL ||
  "http://localhost:3000/api/meetings/schedule";

// Derive the meeting app base URL from the schedule URL (strip /api/meetings/schedule)
const EBUMENYI_MEET_BASE_URL = EBUMENYI_SCHEDULE_URL.replace(/\/api\/meetings\/schedule\/?$/, "");

function buildEventBackendPayload(eventData: any) {
  const [startTimeStr, endTimeStr] = eventData.time.split(" - ");
  const eventDate = new Date(eventData.date);

  const startDateTime = new Date(eventDate);
  const [startHours, startMinutes] = startTimeStr.split(":").map(Number);
  startDateTime.setHours(startHours, startMinutes, 0, 0);

  const endDateTime = new Date(eventDate);
  const [endHours, endMinutes] = endTimeStr.split(":").map(Number);
  endDateTime.setHours(endHours, endMinutes, 0, 0);

  return {
    title: eventData.title,
    description: eventData.description,
    type: eventData.type,
    frequency: eventData.frequency || "NONE",
    daysOfWeek: eventData.daysOfWeek || [],
    timezone: "Africa/Kigali",
    reminderMinutesBefore: Array.isArray(eventData.reminders)
      ? eventData.reminders
      : [Number(eventData.reminders || 30)],
    startAt: startDateTime.toISOString(),
    endAt: endDateTime.toISOString(),
    recurrenceEndsAt: eventData.recurrenceEndsAt || undefined,
    meetingType: eventData.meetingType.toUpperCase().replace("-", "_"),
    location: eventData.location,
    priority: eventData.priority.toUpperCase(),
    hostEmail: eventData.hostEmail,
    participants:
      eventData.attendees?.map((userId: string) => ({
        userId,
      })) || [],
    externalParticipants: (eventData.externalParticipants || []).map(
      (email: string) => ({
        email,
      }),
    ),
    attachments: (eventData.attachments || [])
      .filter((a: { url?: string }) => a?.url)
      .map((a: { url: string; name?: string }) => ({
        name: a.name?.trim() || a.url.split("/").filter(Boolean).pop() || "Attachment",
        url: a.url,
      })),
  };
}

function parseMeetingUrlFromScheduleResponse(
  result: Record<string, unknown>,
): string | null {
  const nested = result.data as Record<string, unknown> | undefined;
  return (
    (result.meetingLink as string) ||
    (result.meetingUrl as string) ||
    (result.url as string) ||
    (result.link as string) ||
    (result.joinUrl as string) ||
    (result.meeting_url as string) ||
    (result.meeting_link as string) ||
    (nested?.meetingLink as string) ||
    (nested?.meetingUrl as string) ||
    (nested?.url as string) ||
    (nested?.link as string) ||
    null
  );
}

function parseStreamRoomIdFromScheduleResponse(
  result: Record<string, unknown>,
  fallbackMeetingId: string,
): string {
  const nested = result.data as Record<string, unknown> | undefined;
  const id =
    (result.meetingId as string) ||
    (nested?.meetingId as string) ||
    fallbackMeetingId;
  return id;
}

async function scheduleEbumenyiMeeting(params: {
  startsAt: string;
  hostEmail: string;
  title: string;
  userId: string;
  meetingId: string;
}): Promise<{ meetingUrl: string; streamRoomId: string } | null> {
  const response = await fetch(EBUMENYI_SCHEDULE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startsAt: params.startsAt,
      hostEmail: params.hostEmail,
      description: params.title,
      userId: params.userId,
      meetingId: params.meetingId,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as Record<string, unknown>;
  const meetingUrl = parseMeetingUrlFromScheduleResponse(result);
  if (!meetingUrl) {
    return null;
  }

  return {
    meetingUrl,
    streamRoomId: parseStreamRoomIdFromScheduleResponse(result, params.meetingId),
  };
}

const Calendar: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const profileEmail = user?.email || "";
  const userRoles = Array.isArray(user?.roles)
    ? user.roles
    : user?.roles
      ? [user.roles]
      : [];
  const isAdmin = userRoles.some((role) =>
    ["ADMIN", "ADMINISTRATOR"].includes(role),
  );

  // Fetch all users
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => getAllUsersNopagination(),
  });

  // Fetch all events
  const { data: eventsData } = useQuery({
    queryKey: ["events"],
    queryFn: () => getAllEvents(),
  });

  const queryClient = useQueryClient();

  // Mutations for event operations
  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event created successfully!");
      setShowEventModal(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to create event");
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<any> }) =>
      updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event updated successfully!");
      setShowEventModal(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update event");
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event deleted successfully!");
      setEventToDelete(null);
      setShowDetailsModal(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to delete event");
    },
  });

  const users = usersData?.data || [];

  // Use events exactly as provided by the backend (no client-side deduplication)
  const events = React.useMemo(() => {
    if (Array.isArray(eventsData?.data)) return eventsData.data;
    if (Array.isArray(eventsData)) return eventsData;
    return [];
  }, [eventsData]);

  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [statsFilterType, setStatsFilterType] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedView, setSelectedView] = useState<"month" | "week" | "day">(
    "month",
  );
  const [quickActionDefaults, setQuickActionDefaults] = useState<any>(null);
  const [selectedDateForForm, setSelectedDateForForm] = useState<string | null>(
    null,
  );
  const [selectedEventType, setSelectedEventType] = useState<string>("TRAINING");
  const [formDate, setFormDate] = useState<string>("");
  const [selectedMeetingType, setSelectedMeetingType] =
    useState<string>("EBUMENYI_MEETING");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<string>("NONE");
  const [isRepeating, setIsRepeating] = useState<boolean>(false);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [recurrenceEnd, setRecurrenceEnd] = useState<string>("");
  const [attendeeSearchTerm, setAttendeeSearchTerm] = useState("");
  const [attendeeFilterRole, setAttendeeFilterRole] = useState("all");
  const [attendeeFilterHospital, setAttendeeFilterHospital] = useState("all");
  const [attendeeFilterDistrict, setAttendeeFilterDistrict] = useState("all");
  const [hospitalFilterOptions, setHospitalFilterOptions] = useState<{ value: string; label: string }[]>([]);
  const [attendeeFilterSector, setAttendeeFilterSector] = useState("all");
  const [attendeeFilterCell, setAttendeeFilterCell] = useState("all");
  const [attendeeFilterVillage, setAttendeeFilterVillage] = useState("all");
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [externalParticipants, setExternalParticipants] = useState<string[]>([]);
  const [externalEmailInput, setExternalEmailInput] = useState("");
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<any>(null);
  const [expandedDate, setExpandedDate] = useState<Date | null>(null);
  const [reminders, setReminders] = useState<number[]>([30]);
  const [reminderInput, setReminderInput] = useState<string>("");
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>(
    [],
  );
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [occurrenceActionMode, setOccurrenceActionMode] = useState<
    "single" | "all" | "future" | null
  >(null);
  const [showOccurrenceActionDialog, setShowOccurrenceActionDialog] =
    useState(false);
  const [occurrenceActionType, setOccurrenceActionType] = useState<
    "edit" | "delete" | null
  >(null);
  const [isProcessingOccurrence, setIsProcessingOccurrence] = useState(false);

  // Initialize selectedEventType and formDate when modal opens
  React.useEffect(() => {
    if (showEventModal) {
      setSelectedEventType(
        editingEvent?.type || quickActionDefaults?.type || "TRAINING",
      );
      setFormDate(
        editingEvent?.startAt
          ? new Date(editingEvent.startAt).toISOString().split("T")[0]
          : selectedDateForForm || getDefaultDate(),
      );
      setSelectedMeetingType(
        editingEvent?.meetingType ||
          quickActionDefaults?.meetingType ||
          "EBUMENYI_MEETING",
      );
      const incomingFrequency = editingEvent?.frequency || "NONE";
      setFrequency(incomingFrequency);
      setIsRepeating(incomingFrequency !== "NONE");
      setDaysOfWeek(editingEvent?.daysOfWeek || []);
      setRecurrenceEnd(
        editingEvent?.recurrenceEndsAt
          ? new Date(editingEvent.recurrenceEndsAt).toISOString().split("T")[0]
          : "",
      );
      setSelectedAttendees(
        editingEvent?.participants?.map((p: any) => p.userId) || [],
      );
      setExternalParticipants(
        editingEvent?.externalParticipants?.map((p: any) => p.email) || [],
      );
      setExternalEmailInput("");
      setReminders(editingEvent?.reminderMinutesBefore || [30]);
      setReminderInput("");
      setAttachments(editingEvent?.attachments || []);
      setAttachmentUrl("");
    }
  }, [showEventModal, editingEvent, quickActionDefaults, selectedDateForForm]);

  const quickReminderOptions = [
    { label: "5m", minutes: 5 },
    { label: "15m", minutes: 15 },
    { label: "30m", minutes: 30 },
    { label: "45m", minutes: 45 },
    { label: "1h", minutes: 60 },
    { label: "2h", minutes: 120 },
    { label: "1d", minutes: 1440 },
    { label: "1w", minutes: 10080 },
  ];

  React.useEffect(() => {
    if (frequency === "WEEKLY" && daysOfWeek.length === 0 && formDate) {
      const startDay = new Date(formDate).getDay();
      setDaysOfWeek([startDay]);
    }
    if (frequency !== "WEEKLY" && daysOfWeek.length > 0) {
      setDaysOfWeek([]);
    }
  }, [frequency, formDate, daysOfWeek.length]);

  const fetchHospitalOptions = React.useCallback(async (district?: string) => {
    try {
      const params = district && district !== "all" ? { district } : undefined;
      const hospitals = await getPublicHospitals(params);
      setHospitalFilterOptions(hospitals.map((h) => ({ value: h.id, label: h.name })));
    } catch (err) {
      console.error("[Calendar] failed to load hospitals:", err);
    }
  }, []);

  // Load all hospitals on mount
  React.useEffect(() => {
    fetchHospitalOptions();
  }, [fetchHospitalOptions]);

  // Re-fetch hospitals filtered by district, reset hospital selection
  const isFirstDistrictRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstDistrictRender.current) {
      isFirstDistrictRender.current = false;
      return;
    }
    fetchHospitalOptions(attendeeFilterDistrict);
    setAttendeeFilterHospital("all");
  }, [attendeeFilterDistrict, fetchHospitalOptions]);

  // Event management functions
  const sendEventToBackend = (eventData: any, _editingEvent?: any) => {
    const backendPayload = buildEventBackendPayload(eventData);

    // Use the mutation to create/update the event
    if (eventData.id) {
      // Update existing event
      updateEventMutation.mutate({ id: eventData.id, data: backendPayload });
    } else {
      // Create new event
      createEventMutation.mutate(backendPayload);
    }
  };

  const handleCreateEvent = async (eventData: any) => {
    const finalEventData = { ...eventData };

    // Validate required title field
    if (!eventData.title || eventData.title.trim() === "") {
      toast.error("Title is required");
      return false;
    }

    // Validate required description field
    if (!eventData.description || eventData.description.trim() === "") {
      toast.error("Description is required");
      return false;
    }

    if (
      eventData.frequency === "WEEKLY" &&
      (!eventData.daysOfWeek || eventData.daysOfWeek.length === 0)
    ) {
      toast.error("Select at least one weekday for weekly repeats");
      return false;
    }

    // Validate "Ends On" is mandatory for repeating events
    if (
      eventData.frequency !== "NONE" &&
      (!eventData.recurrenceEndsAt ||
        (typeof eventData.recurrenceEndsAt === "string" &&
          eventData.recurrenceEndsAt.trim() === ""))
    ) {
      toast.error(
        `Please set an "Ends On" date for ${eventData.frequency} repeating events`,
      );
      return false;
    }

    // Validate required hostEmail field
    if (!eventData.hostEmail || eventData.hostEmail.trim() === "") {
      toast.error("Host email is required");
      return false;
    }

    // Validate date is not in the past
    const eventDate = new Date(eventData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDate < today) {
      toast.error("Event date cannot be in the past");
      return false;
    }

    if (eventData.recurrenceEndsAt && eventData.recurrenceEndsAt < eventData.date) {
      toast.error("Recurrence end date must be after start date");
      return false;
    }

    // Validate at least one participant is required
    const hasParticipants =
      (eventData.attendees && eventData.attendees.length > 0) ||
      (eventData.externalParticipants && eventData.externalParticipants.length > 0);
    if (!hasParticipants) {
      toast.error("At least one participant is required");
      return false;
    }

    // EBUMENYI: calendar event id = Stream call id (same as chw-meeting) so recordings link correctly
    if (eventData.meetingType === "EBUMENYI_MEETING") {
      if (!user?.id) {
        toast.error("You must be signed in to schedule a meeting");
        return false;
      }

      setIsCreatingMeeting(true);
      try {
        const dateStr = eventData.date.toISOString().split("T")[0];
        const startTime = eventData.time.split(" - ")[0];
        const localDateTime = new Date(`${dateStr}T${startTime}:00`);
        const startsAt = localDateTime.toISOString();

        const payload = buildEventBackendPayload(finalEventData);
        const calendarEventId = editingEvent?.id as string | undefined;

        const finishSuccess = () => {
          queryClient.invalidateQueries({ queryKey: ["events"] });
          toast.success(
            calendarEventId ? "Event updated successfully!" : "Event created successfully!",
          );
          setShowEventModal(false);
          setIsCreatingMeeting(false);
        };

        if (calendarEventId) {
          const existingStreamRoomId = editingEvent?.streamRoomId as string | undefined;
          const existingLocation = editingEvent?.location as string | undefined;

          // Notify Stream of the updated start time but don't let it
          // overwrite the stored link — the room ID is fixed at creation.
          const scheduled = await scheduleEbumenyiMeeting({
            startsAt,
            hostEmail: eventData.hostEmail,
            title: eventData.title,
            userId: user.id,
            meetingId: existingStreamRoomId || calendarEventId,
          });

          if (!scheduled) {
            toast.error("Failed to update video meeting room");
            setIsCreatingMeeting(false);
            return false;
          }

          await updateEvent(calendarEventId, {
            ...payload,
            // Preserve whatever is already stored; only fill from Stream's
            // response when the event has no room yet (e.g. old data).
            location: existingLocation || scheduled.meetingUrl,
            streamRoomId: existingStreamRoomId || scheduled.streamRoomId,
          });
          finishSuccess();
        } else {
          const created = await createEvent({ ...payload, location: "" });
          const newCalendarId = created.data?.id;

          if (!newCalendarId) {
            toast.error("Failed to create calendar event");
            setIsCreatingMeeting(false);
            return false;
          }

          const scheduled = await scheduleEbumenyiMeeting({
            startsAt,
            hostEmail: eventData.hostEmail,
            title: eventData.title,
            userId: user.id,
            meetingId: newCalendarId,
          });

          if (!scheduled) {
            await deleteEvent(newCalendarId).catch(() => undefined);
            toast.error("Failed to create video meeting room");
            setIsCreatingMeeting(false);
            return false;
          }

          await updateEvent(newCalendarId, {
            location: scheduled.meetingUrl,
            streamRoomId: scheduled.streamRoomId,
          });
          finishSuccess();
        }

        return true;
      } catch {
        toast.error("Network error while creating meeting. Please try again.");
        setShowSignInModal(true);
        setIsCreatingMeeting(false);
        return false;
      }
    } else {
      // For non-ebumenyi meetings, send to backend immediately since we have all data
      sendEventToBackend(finalEventData, editingEvent);
    }

    // Events are managed by React Query, no need to manually update local state
    return true;
  };

  const handleViewEvent = (event: any) => {
    setSelectedEvent(event);
    setShowDetailsModal(true);
  };

  const handleDeleteEvent = (event: any) => {
    // If recurring, show occurrence mode selection dialog
    if (event.isRepeating && event.commonId) {
      setEventToDelete(event);
      setOccurrenceActionType("delete");
      setShowOccurrenceActionDialog(true);
    } else {
      // For non-recurring events, show delete confirmation modal
      setEventToDelete(event);
    }
  };

  const confirmDeleteEvent = async () => {
    const event = eventToDelete;
    if (!event) return;

    try {
      // For recurring events with selected mode
      if (event.isRepeating && event.commonId && occurrenceActionMode) {
        // Pass the mode directly to cancelOccurrence
        await cancelOccurrence(
          event.id,
          occurrenceActionMode as "single" | "all" | "future",
        );
        toast.success("Occurrence deleted successfully!");
      } else {
        // Non-recurring event
        deleteEventMutation.mutate(event.id);
        return;
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setEventToDelete(null);
      setShowDetailsModal(false);
      setOccurrenceActionMode(null);
      setOccurrenceActionType(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to delete occurrence");
    }
  };

  // Helper function to get default date (today)
  const getDefaultDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  // Helper function to get default time (current time + 1 hour)
  const getDefaultTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toTimeString().slice(0, 5);
  };

  // Helper function to get end time (start time + 1 hour)
  const getEndTime = (startTime: string) => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const endTime = new Date();
    endTime.setHours(hours + 1, minutes);
    return endTime.toTimeString().slice(0, 5);
  };

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // Helper function to calculate event status based on startAt and endAt
  const getEventStatus = (startAt: string, endAt: string) => {
    const now = new Date();
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (now < start) {
      return "scheduled";
    } else if (now >= start && now <= end) {
      return "ongoing";
    } else {
      return "completed";
    }
  };

  // Helper function to format location display
  const formatLocation = (location: string) => {
    if (!location) return "";

    // Check if it's a meeting URL — extract the meeting ID and rebuild with the local base URL
    const meetingIdMatch = location.match(/\/meeting\/([a-z0-9-]+)/i);
    if (meetingIdMatch) {
      const meetingHref = `${EBUMENYI_MEET_BASE_URL}/meeting/${meetingIdMatch[1]}`;
      return (
        <a
          href={meetingHref}
          target='_blank'
          rel='noopener noreferrer'
          className='text-blue-600 hover:text-blue-800 underline'
        >
          Virtual Meeting
        </a>
      );
    }

    // Non-meeting URLs (physical location etc.)
    const urlPattern = /^https?:\/\//i;
    if (urlPattern.test(location)) {
      return (
        <a
          href={location}
          target='_blank'
          rel='noopener noreferrer'
          className='text-blue-600 hover:text-blue-800 underline'
        >
          {location}
        </a>
      );
    }

    // For physical meetings or other locations, display as is
    return location;
  };

  // Helper functions for attendees
  const getFilteredUsers = () => {
    return users.filter((user) => {
      const matchesSearch =
        !attendeeSearchTerm ||
        user.fullNames.toLowerCase().includes(attendeeSearchTerm.toLowerCase()) ||
        user.phoneNumber.includes(attendeeSearchTerm);
      const matchesRole =
        attendeeFilterRole === "all" ||
        user.userRoles[0]?.name === attendeeFilterRole;
      const matchesHospital =
        attendeeFilterHospital === "all" ||
        user?.hospital?.id === attendeeFilterHospital;
      const matchesDistrict =
        attendeeFilterDistrict === "all" || user.district === attendeeFilterDistrict;
      const matchesSector =
        attendeeFilterSector === "all" || user.sector === attendeeFilterSector;
      const matchesCell =
        attendeeFilterCell === "all" || user.cell === attendeeFilterCell;
      const matchesVillage =
        attendeeFilterVillage === "all" || user.village === attendeeFilterVillage;
      return (
        matchesSearch &&
        matchesRole &&
        matchesHospital &&
        matchesDistrict &&
        matchesSector &&
        matchesCell &&
        matchesVillage
      );
    });
  };

  const handleSelectAllCHW = () => {
    const chwIds = users
      .filter((user) => ["TRAINEE", "TESTER"].includes(user.userRoles[0]?.name))
      .map((user) => user.id);
    if (isAllCHWSelected()) {
      setSelectedAttendees((prev) => prev.filter((id) => !chwIds.includes(id)));
    } else {
      setSelectedAttendees((prev) => [...new Set([...prev, ...chwIds])]);
    }
  };

  const handleSelectAllTrainer = () => {
    const trainerIds = users
      .filter((user) => user.userRoles[0]?.name === "TRAINER")
      .map((user) => user.id);
    if (isAllTrainersSelected()) {
      setSelectedAttendees((prev) => prev.filter((id) => !trainerIds.includes(id)));
    } else {
      setSelectedAttendees((prev) => [...new Set([...prev, ...trainerIds])]);
    }
  };

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const parseDurationToMinutes = (input: string): number | null => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;
    const match = trimmed.match(/^([0-9]+)\s*(m|h|d|w)?$/);
    if (!match) return null;
    const value = Number(match[1]);
    if (Number.isNaN(value) || value <= 0) return null;
    const unit = match[2] || "m";
    switch (unit) {
      case "m":
        return value;
      case "h":
        return value * 60;
      case "d":
        return value * 60 * 24;
      case "w":
        return value * 60 * 24 * 7;
      default:
        return null;
    }
  };

  const formatMinutesLabel = (minutes: number) => {
    if (minutes % (60 * 24 * 7) === 0) return `${minutes / (60 * 24 * 7)}w before`;
    if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)}d before`;
    if (minutes % 60 === 0 && minutes >= 60) return `${minutes / 60}h before`;
    return `${minutes}m before`;
  };

  const handleAddReminder = (value?: number) => {
    const parsed =
      typeof value === "number" ? value : parseDurationToMinutes(reminderInput);
    if (!parsed) {
      toast.error("Use numbers with optional m/h/d/w (e.g., 45m, 2h, 1d)");
      return;
    }
    setReminders((prev) => [...new Set([...prev, parsed])].sort((a, b) => a - b));
    setReminderInput("");
  };

  const handleRemoveReminder = (value: number) => {
    setReminders((prev) => prev.filter((r) => r !== value));
  };

  const handleAddAttachment = () => {
    if (!attachmentUrl.trim()) {
      toast.error("Attachment link is required");
      return;
    }
    const cleanUrl = attachmentUrl.trim();
    const label = getAttachmentLabel(cleanUrl);
    setAttachments((prev) => [...prev, { name: label, url: cleanUrl }]);
    setAttachmentUrl("");
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploadingAttachment(true);
    try {
      const uploads = await Promise.all(
        Array.from(fileList).map(async (file) => {
          const res = await uploadFileByType(file);
          if (res?.data?.url) {
            return {
              name:
                (res as any)?.data?.displayName ||
                res.data.originalName ||
                getAttachmentLabel(res.data.url, file.name),
              url: res.data.url,
            };
          }
          return null;
        }),
      );
      setAttachments((prev) => [
        ...prev,
        ...(uploads.filter(Boolean) as { name: string; url: string }[]),
      ]);
      toast.success("Attachment uploaded");
    } catch (err) {
      toast.error("Upload failed, please try again.");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleAttendeeToggle = (userId: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  // const handleClearAttendees = () => {
  //   setSelectedAttendees([]);
  // };

  // Helper functions to check if all are selected
  const isAllCHWSelected = () => {
    const chwIds = users
      .filter((user) => ["TRAINEE", "TESTER"].includes(user.userRoles[0]?.name))
      .map((user) => user.id);
    return chwIds.length > 0 && chwIds.every((id) => selectedAttendees.includes(id));
  };

  const isAllFilteredSelected = () => {
    const filteredUsers = getFilteredUsers();
    return (
      filteredUsers.length > 0 &&
      filteredUsers.every((user) => selectedAttendees.includes(user.id))
    );
  };

  const isAllTrainersSelected = () => {
    const trainerIds = users
      .filter((user) => user.userRoles[0]?.name === "TRAINER")
      .map((user) => user.id);
    return (
      trainerIds.length > 0 &&
      trainerIds.every((id) => selectedAttendees.includes(id))
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredUsers = getFilteredUsers();
    const filteredIds = filteredUsers.map((user) => user.id);

    if (isAllFilteredSelected()) {
      // Unselect all filtered users
      setSelectedAttendees((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      // Select all filtered users
      setSelectedAttendees((prev) => [...new Set([...prev, ...filteredIds])]);
    }
  };

  // Helper functions for external participants
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddExternalParticipant = () => {
    const email = externalEmailInput.trim().toLowerCase();
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (externalParticipants.includes(email)) {
      toast.error("This email is already added");
      return;
    }
    setExternalParticipants((prev) => [...prev, email]);
    setExternalEmailInput("");
  };

  const handleRemoveExternalParticipant = (email: string) => {
    setExternalParticipants((prev) => prev.filter((p) => p !== email));
  };

  const handleExternalEmailKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddExternalParticipant();
    }
  };

  const handleDayClick = (date: Date) => {
    // Check if the selected date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      toast.error("Cannot create events on past dates");
      return;
    }

    // Always create a new event when clicking on a day, regardless of existing events
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const localDateString = `${year}-${month}-${day}`;
    setSelectedDateForForm(localDateString);
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const getEventTypeIcon = (type: string) => {
    switch (
      type.toUpperCase() // Handle case insensitivity
    ) {
      case "TRAINING":
        return <GraduationCap className='w-4 h-4' />;
      case "WEBINAR":
        return <Video className='w-4 h-4' />;
      case "MEETING":
        return <Users className='w-4 h-4' />;
      case "SCREENING":
        return <ClipboardCheck className='w-4 h-4' />;
      case "DRILL":
        return <AlertCircle className='w-4 h-4' />;
      default:
        return <CalendarIcon className='w-4 h-4' />;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (
      type.toUpperCase() // Handle case insensitivity
    ) {
      case "TRAINING":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "WEBINAR":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "MEETING":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "SCREENING":
        return "bg-green-100 text-green-800 border-green-200";
      case "DRILL":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toUpperCase()) {
      case "HIGH":
        return "text-red-600";
      case "MEDIUM":
        return "text-yellow-600";
      case "LOW":
        return "text-green-600";
      case "URGENT":
        return "text-purple-600";
      default:
        return "text-gray-600";
    }
  };

  const isImageUrl = (url: string) => {
    const clean = (url || "").split("?")[0];
    return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(clean);
  };

  const getAttachmentLabel = (url: string, fallback?: string) => {
    const preferred = fallback?.trim();
    if (preferred) return preferred;
    const cleanUrl = (url || "").split("?")[0];
    const lastSegment = cleanUrl.split("/").filter(Boolean).pop() || cleanUrl;
    const withoutExt = lastSegment.replace(/\.[^/.]+$/, "");
    const maybeDouble = withoutExt.replace(/\.[^/.]+$/, "");
    const label = (withoutExt || maybeDouble).trim();
    return label || "Attachment";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <span className='inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full'>
            <CheckCircle className='w-3 h-3' />
            Confirmed
          </span>
        );
      case "pending":
        return (
          <span className='inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full'>
            <Clock className='w-3 h-3' />
            Pending
          </span>
        );
      case "scheduled":
        return (
          <span className='inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full'>
            <CalendarIcon className='w-3 h-3' />
            Scheduled
          </span>
        );
      case "ongoing":
        return (
          <span className='inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full'>
            <Clock className='w-3 h-3' />
            Ongoing
          </span>
        );
      case "completed":
        return (
          <span className='inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full'>
            <CheckCircle className='w-3 h-3' />
            Completed
          </span>
        );
      default:
        return (
          <span className='px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full'>
            {status}
          </span>
        );
    }
  };

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);

    // Filter events based on search and filters
    const filteredEvents = events?.filter((event) => {
      const matchesSearch =
        !searchTerm ||
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === "all" || event.type === filterType;
      const matchesStatus =
        filterStatus === "all" ||
        (event.startAt &&
          event.endAt &&
          getEventStatus(event.startAt, event.endAt) === filterStatus);
      const matchesStatsFilter =
        !statsFilterType || event.type?.toUpperCase() === statsFilterType;

      return matchesSearch && matchesType && matchesStatus && matchesStatsFilter;
    });

    for (let i = 0; i < 42; i++) {
      const dayEvents = filteredEvents.filter(
        (event) =>
          event.startAt &&
          new Date(event.startAt).toDateString() === current.toDateString(),
      );

      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        isToday: current.toDateString() === new Date().toDateString(),
        events: dayEvents,
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const navigateDate = (direction: "prev" | "next") => {
    setCurrentDate((prev: Date) => {
      const newDate = new Date(prev);

      switch (selectedView) {
        case "month":
          newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
          break;
        case "week":
          newDate.setDate(prev.getDate() + (direction === "next" ? 7 : -7));
          break;
        case "day":
          newDate.setDate(prev.getDate() + (direction === "next" ? 1 : -1));
          break;
        default:
          newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      }

      return newDate;
    });
    // Clear stats filter when navigating to different periods
    setStatsFilterType(null);
  };

  const formatDate = (date: Date) => {
    switch (selectedView) {
      case "month": {
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        });
      }
      case "week": {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return `${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      }
      case "day": {
        return date.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
      default: {
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        });
      }
    }
  };

  const renderCalendarView = () => {
    switch (selectedView) {
      case "month":
        return renderMonthView();
      case "week":
        return renderWeekView();
      case "day":
        return renderDayView();
      default:
        return renderMonthView();
    }
  };

  const renderMonthView = () => (
    <div className='bg-white rounded-lg shadow overflow-hidden'>
      {/* Calendar Header */}
      <div className='grid grid-cols-7 bg-gray-50'>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className='p-3 text-center text-sm font-medium text-gray-700 border-r border-gray-200 last:border-r-0'
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className='grid grid-cols-7'>
        {generateCalendarDays().map((day, index) => (
          <div
            key={index}
            onClick={() => handleDayClick(day.date)}
            className={`min-h-[120px] p-2 border-r border-b border-gray-200 last:border-r-0 cursor-pointer hover:bg-gray-50 transition-colors ${
              !day.isCurrentMonth ? "bg-gray-50" : "bg-white"
            } ${day.isToday ? "bg-blue-50" : ""}`}
          >
            <div
              className={`text-sm mb-1 ${
                day.isToday
                  ? "w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold"
                  : day.isCurrentMonth
                    ? "text-gray-900 font-medium"
                    : "text-gray-400"
              }`}
            >
              {day.date.getDate()}
            </div>

            <div className='space-y-1'>
              {day.events.slice(0, 2).map((event) => (
                <div
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewEvent(event);
                  }}
                  className={`text-xs p-1 rounded border ${getEventTypeColor(event.type)} cursor-pointer hover:shadow-sm transition-shadow`}
                  title={`${event.title} - ${event.startAt ? new Date(event.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""} to ${event.endAt ? new Date(event.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}`}
                >
                  <div className='flex items-center gap-1'>
                    {getEventTypeIcon(event.type)}
                    <span className='truncate'>{event.title}</span>
                  </div>
                </div>
              ))}
              {day.events.length > 2 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedDate(
                      expandedDate?.toDateString() === day.date.toDateString()
                        ? null
                        : day.date,
                    );
                  }}
                  className='text-xs text-blue-600 hover:text-blue-800 hover:underline pl-1 cursor-pointer font-medium'
                >
                  +{day.events.length - 2} more
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const weekDays: { date: Date; events: any[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dayEvents = events.filter(
        (event: any) =>
          event.startAt &&
          new Date(event.startAt).toDateString() === day.toDateString(),
      );
      weekDays.push({ date: day, events: dayEvents });
    }

    return (
      <div className='bg-white rounded-lg shadow overflow-hidden'>
        <div className='grid grid-cols-8 bg-gray-50'>
          <div className='p-3 text-center text-sm font-medium text-gray-700 border-r border-gray-200'>
            Time
          </div>
          {weekDays.map((day, index) => (
            <div
              key={index}
              className='p-3 text-center text-sm font-medium text-gray-700 border-r border-gray-200 last:border-r-0'
            >
              <div>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][index]}</div>
              <div
                className={`text-lg ${day.date.toDateString() === new Date().toDateString() ? "text-blue-600 font-bold" : ""}`}
              >
                {day.date.getDate()}
              </div>
            </div>
          ))}
        </div>

        <div className='max-h-[1800px]'>
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className='grid grid-cols-8 border-b border-gray-200'>
              <div className='p-2 text-xs text-gray-500 text-center border-r border-gray-200'>
                {hour.toString().padStart(2, "0")}:00
              </div>
              {weekDays.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className='p-1 border-r border-gray-200 last:border-r-0 min-h-[40px] cursor-pointer hover:bg-gray-50'
                  onClick={() => handleDayClick(day.date)}
                >
                  {day.events
                    .filter((event: any) => {
                      const eventHour = event.startAt
                        ? new Date(event.startAt).getHours()
                        : -1;
                      return eventHour === hour;
                    })
                    .map((event: any) => (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewEvent(event);
                        }}
                        className={`text-xs p-1 mb-1 rounded border ${getEventTypeColor(event.type)} cursor-pointer hover:shadow-sm`}
                      >
                        {event.title}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = events
      .filter(
        (event) =>
          event.startAt &&
          new Date(event.startAt).toDateString() === currentDate.toDateString(),
      )
      .sort((a, b) =>
        a.startAt && b.startAt
          ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
          : 0,
      );

    return (
      <div className='bg-white rounded-lg shadow overflow-hidden'>
        <div className='p-4 border-b border-gray-200'>
          <h3 className='text-lg font-semibold text-gray-900'>
            {currentDate.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </h3>
        </div>

        <div className='max-h-96 overflow-y-auto'>
          {dayEvents.length === 0 ? (
            <div className='p-8 text-center text-gray-500'>
              <CalendarIcon className='w-12 h-12 mx-auto mb-4 text-gray-300' />
              <p>No events scheduled for this day</p>
            </div>
          ) : (
            <div className='divide-y divide-gray-200'>
              {dayEvents.map((event: any) => (
                <div key={event.id} className='p-4 hover:bg-gray-50'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='flex items-center gap-3'>
                      <div
                        className={`p-2 rounded-lg ${getEventTypeColor(event.type)}`}
                      >
                        {getEventTypeIcon(event.type)}
                      </div>
                      <div>
                        <h4 className='font-medium text-gray-900'>{event.title}</h4>
                        <div className='flex items-center gap-4 text-sm text-gray-600'>
                          <div className='flex items-center gap-1'>
                            <Clock className='w-4 h-4' />
                            {event.startAt
                              ? new Date(event.startAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </div>
                          <div className='flex items-center gap-1'>
                            <MapPin className='w-4 h-4' />
                            {formatLocation(event.location)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      {getStatusBadge(
                        event.startAt && event.endAt
                          ? getEventStatus(event.startAt, event.endAt)
                          : "scheduled",
                      )}
                      <div className='flex gap-1'>
                        {isAdmin && event.meetingType === 'EBUMENYI_MEETING' && (
                          <button
                            onClick={() => navigate(`/attendance/${event.id}`)}
                            className='p-1 text-gray-400 hover:text-green-600'
                            title='View attendance'
                          >
                            <Users className='w-4 h-4' />
                          </button>
                        )}
                        <button
                          onClick={() => handleViewEvent(event)}
                          className='p-1 text-gray-400 hover:text-blue-600'
                          title='View details'
                        >
                          <Eye className='w-4 h-4' />
                        </button>
                        <button
                          onClick={() => {
                            setEditingEvent(event);
                            setShowEventModal(true);
                          }}
                          className='p-1 text-gray-400 hover:text-gray-600'
                          title='Edit event'
                        >
                          <Edit className='w-4 h-4' />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(event)}
                          className='p-1 text-gray-400 hover:text-red-600'
                          title='Delete event'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className='text-sm text-gray-600 mt-2'>{event.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const upcomingEvents = events
    .filter((event) => {
      const matchesSearch =
        !searchTerm ||
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === "all" || event.type === filterType;
      const matchesStatus =
        filterStatus === "all" ||
        (event.startAt &&
          event.endAt &&
          getEventStatus(event.startAt, event.endAt) === filterStatus);
      const matchesStatsFilter =
        !statsFilterType || event.type?.toUpperCase() === statsFilterType;

      return (
        event.startAt &&
        new Date(event.startAt) >= new Date() &&
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesStatsFilter
      );
    })
    .sort((a, b) =>
      a.startAt && b.startAt
        ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        : 0,
    )
    .slice(0, 3);

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='mb-6'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900 mb-2'>Calendar</h1>
            <p className='text-gray-600'>
              Manage training sessions, screenings, and events
            </p>
          </div>
          <div className='flex items-center gap-3'>
            {isAdmin && (
              <button
                onClick={() => navigate('/meetings')}
                className='flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors'
              >
                <Users className='w-4 h-4' />
                View Meetings
              </button>
            )}
            <button
              onClick={() => navigate(isAdmin ? "/recordings" : "/recordings/watch")}
              className='flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors'
            >
              <Video className='w-4 h-4' />
              View Recordings
            </button>
            <button
              onClick={() => setShowEventModal(true)}
              className='flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg  font-medium hover:bg-[#4d81d2]'
            >
              <Plus className='w-4 h-4' />
              New Event
            </button>
          </div>
        </div>

        {/* Calendar Controls */}
        <div className='flex items-center justify-between bg-white rounded-lg shadow p-4'>
          <div className='flex items-center gap-4'>
            <button
              onClick={() => navigateDate("prev")}
              className='p-2 hover:bg-gray-100 rounded-lg'
            >
              <ChevronLeft className='w-5 h-5' />
            </button>
            <h2 className='text-xl font-semibold text-gray-900'>
              {formatDate(currentDate)}
            </h2>
            <button
              onClick={() => navigateDate("next")}
              className='p-2 hover:bg-gray-100 rounded-lg'
            >
              <ChevronRight className='w-5 h-5' />
            </button>
          </div>

          <div className='flex items-center gap-3'>
            {/* Search */}
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
              <TextField
                type='text'
                placeholder='Search events...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                additionalClass='pl-10 pr-4 py-2 w-64'
              />
            </div>

            {/* Filters */}
            <OptionsField
              options={[
                { value: "all", label: "All Types" },
                { value: "TRAINING", label: "Training" },
                { value: "WEBINAR", label: "Webinar" },
                { value: "MEETING", label: "Meeting" },
                { value: "SCREENING", label: "Screening" },
                { value: "DRILL", label: "Drill" },
              ]}
              value={filterType}
              onChange={(value) => setFilterType(value)}
              defaultLabel='Select type...'
            />

            <OptionsField
              options={[
                { value: "all", label: "All Status" },
                { value: "confirmed", label: "Confirmed" },
                { value: "pending", label: "Pending" },
                { value: "scheduled", label: "Scheduled" },
              ]}
              value={filterStatus}
              onChange={(value) => setFilterStatus(value)}
              defaultLabel='Select status...'
            />

            <div className='flex bg-gray-100 rounded-lg p-1'>
              {["month", "week", "day"].map((view) => (
                <button
                  key={view}
                  onClick={() => {
                    setSelectedView(view as any);
                    // Clear stats filter when switching views (stats are month-specific)
                    if (view !== "month") {
                      setStatsFilterType(null);
                    }
                  }}
                  className={`px-3 py-1 rounded-md capitalize transition-colors ${
                    selectedView === view
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {expandedDate ? (
        // Expanded date view - real calendar and sidebar on left, events in center
        <div className='grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 min-h-screen px-3 md:px-0'>
          {/* Left Panel: Real Calendar + Sidebars */}
          <div className='col-span-1 md:col-span-1 lg:col-span-1 space-y-3 md:space-y-4'>
            {/* Real Small Calendar */}
            <div className='bg-white rounded-lg shadow p-2 md:p-3'>
              <div className='flex items-center justify-between mb-2 md:mb-3'>
                <button
                  onClick={() =>
                    setCurrentDate(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() - 1,
                      ),
                    )
                  }
                  className='p-0.5 md:p-1 hover:bg-gray-100 rounded'
                >
                  <ChevronLeft className='w-3 h-3' />
                </button>
                <h3 className='text-xs md:text-sm font-semibold text-gray-900'>
                  {currentDate.toLocaleString("default", {
                    month: "short",
                    year: "numeric",
                  })}
                </h3>
                <button
                  onClick={() =>
                    setCurrentDate(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() + 1,
                      ),
                    )
                  }
                  className='p-0.5 md:p-1 hover:bg-gray-100 rounded'
                >
                  <ChevronRight className='w-3 h-3' />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className='space-y-1 md:space-y-2'>
                {/* Day headers */}
                <div className='grid grid-cols-7 gap-0.5 md:gap-1'>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className='text-xs font-semibold text-center text-gray-600 py-0.5 md:py-1'
                    >
                      {day.slice(0, 1)}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className='grid grid-cols-7 gap-0.5 md:gap-1'>
                  {(() => {
                    const firstDay = new Date(
                      currentDate.getFullYear(),
                      currentDate.getMonth(),
                      1,
                    );
                    const lastDay = new Date(
                      currentDate.getFullYear(),
                      currentDate.getMonth() + 1,
                      0,
                    );
                    const daysInMonth = lastDay.getDate();
                    const startingDayOfWeek = firstDay.getDay();
                    const days = [];

                    // Empty cells for days before month starts
                    for (let i = 0; i < startingDayOfWeek; i++) {
                      days.push(null);
                    }

                    // Days of the month
                    for (let day = 1; day <= daysInMonth; day++) {
                      days.push(day);
                    }

                    return days.map((day, index) => {
                      if (day === null) {
                        return <div key={`empty-${index}`}></div>;
                      }

                      const date = new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth(),
                        day,
                      );
                      const isToday =
                        date.toDateString() === new Date().toDateString();
                      const isSelectedDate =
                        expandedDate &&
                        date.toDateString() === expandedDate.toDateString();
                      const hasEvents = events.some(
                        (event: any) =>
                          event.startAt &&
                          new Date(event.startAt).toDateString() ===
                            date.toDateString(),
                      );

                      return (
                        <button
                          key={day}
                          onClick={() => {
                            const newDate = new Date(
                              currentDate.getFullYear(),
                              currentDate.getMonth(),
                              day,
                            );
                            setExpandedDate(newDate);
                          }}
                          className={`text-xs p-0.5 md:p-1 rounded text-center transition-colors ${
                            isSelectedDate
                              ? "bg-blue-600 text-white font-semibold"
                              : isToday
                                ? "bg-blue-100 text-blue-900 font-semibold"
                                : "hover:bg-gray-100 text-gray-700"
                          } ${hasEvents && !isSelectedDate ? "font-semibold" : ""}`}
                        >
                          {day}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Upcoming Events Sidebar - Limited to 5 items */}
            <div className='bg-white rounded-lg shadow p-2 md:p-3'>
              <div className='flex items-center gap-1 md:gap-2 mb-2 md:mb-3'>
                <Bell className='w-3 h-3 md:w-4 md:h-4 text-gray-600' />
                <h3 className='font-semibold text-xs md:text-sm text-gray-900'>
                  Upcoming
                </h3>
              </div>

              <div className='space-y-1 md:space-y-2'>
                {upcomingEvents.slice(0, 3).length > 0 ? (
                  upcomingEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className='border-l-2 border-blue-500 pl-1 md:pl-2 py-0.5 md:py-1'
                    >
                      <h4 className='text-xs font-medium text-gray-900 mb-0.5 truncate'>
                        {event.title}
                      </h4>
                      <p className='text-xs text-gray-600 mb-0.5'>
                        {event.startAt
                          ? new Date(event.startAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </p>
                      <div
                        className={`text-xs font-medium ${getPriorityColor(event.priority)}`}
                      >
                        {event.priority?.toLowerCase()}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className='text-xs text-gray-500'>No upcoming events</p>
                )}
              </div>
            </div>

            {/* This Month Statistics - Limited to 5 items */}
            <div className='bg-white rounded-lg shadow p-2 md:p-3'>
              <h3 className='font-semibold text-xs md:text-sm text-gray-900 mb-2 md:mb-3'>
                This Month
              </h3>

              <div className='space-y-1 md:space-y-2'>
                {(() => {
                  const currentDate = new Date();
                  const currentMonth = currentDate.getMonth();
                  const currentYear = currentDate.getFullYear();

                  const monthEvents = events.filter((event) => {
                    const eventDate = event.startAt ? new Date(event.startAt) : null;
                    // Month and year filter
                    if (
                      !eventDate ||
                      eventDate.getMonth() !== currentMonth ||
                      eventDate.getFullYear() !== currentYear
                    ) {
                      return false;
                    }
                    // Type filter
                    if (filterType !== "all" && event.type !== filterType) {
                      return false;
                    }
                    // Status filter
                    if (filterStatus !== "all" && event.status !== filterStatus) {
                      return false;
                    }
                    // Search filter
                    if (searchTerm) {
                      const matchesSearch =
                        event.title
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()) ||
                        event.description
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()) ||
                        event.location
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase());
                      if (!matchesSearch) {
                        return false;
                      }
                    }
                    return true;
                  });

                  const eventTypes = [
                    "TRAINING",
                    "WEBINAR",
                    "MEETING",
                    "SCREENING",
                    "DRILL",
                  ];
                  const statItems = eventTypes
                    .map((type) => ({
                      type,
                      label: type.charAt(0) + type.slice(1).toLowerCase(),
                      count: monthEvents.filter((e) => e.type === type).length,
                      color: {
                        TRAINING: "bg-blue-500",
                        WEBINAR: "bg-purple-500",
                        MEETING: "bg-gray-500",
                        SCREENING: "bg-green-500",
                        DRILL: "bg-red-500",
                      }[type],
                    }))
                    .filter((item) => item.count > 0)
                    .slice(0, 5);

                  return statItems.length > 0 ? (
                    statItems.map((item) => (
                      <div
                        key={item.type}
                        className='flex items-center justify-between p-1 md:p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors'
                      >
                        <div className='flex items-center gap-1 md:gap-2'>
                          <div
                            className={`w-2 h-2 ${item.color} rounded-full`}
                          ></div>
                          <span className='text-xs text-gray-600'>{item.label}</span>
                        </div>
                        <span className='text-xs font-medium text-gray-900'>
                          {item.count}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className='text-center text-gray-500 text-xs py-2'>
                      No events this month
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Quick Actions */}
            <div className='bg-white rounded-lg shadow p-2 md:p-3'>
              <h3 className='font-semibold text-xs md:text-sm text-gray-900 mb-2 md:mb-3'>
                Quick Actions
              </h3>

              <div className='space-y-0.5 md:space-y-1'>
                <button
                  onClick={() => {
                    setQuickActionDefaults({
                      type: "TRAINING",
                      title: "Training Session",
                      location: "Kigali Health Center",
                      meetingType: "OTHER",
                      instructor: "",
                      attendees: 15,
                    });
                    setEditingEvent(null);
                    setShowEventModal(true);
                  }}
                  className='w-full flex items-center gap-1 md:gap-2 px-1 md:px-2 py-1 md:py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 rounded-lg transition-colors'
                >
                  <GraduationCap className='w-3 h-3 md:w-4 md:h-4 flex-shrink-0' />
                  <span className='truncate'>Training</span>
                </button>
                <button
                  onClick={() => {
                    setQuickActionDefaults({
                      type: "SCREENING",
                      title: "Health Screening",
                      location: "Community Health Center",
                      meetingType: "OTHER",
                      coordinator: "",
                      attendees: 45,
                    });
                    setEditingEvent(null);
                    setShowEventModal(true);
                  }}
                  className='w-full flex items-center gap-1 md:gap-2 px-1 md:px-2 py-1 md:py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 rounded-lg transition-colors'
                >
                  <ClipboardCheck className='w-3 h-3 md:w-4 md:h-4 flex-shrink-0' />
                  <span className='truncate'>Screening</span>
                </button>
                <button
                  onClick={() => {
                    setQuickActionDefaults({
                      type: "WEBINAR",
                      title: "Health Webinar",
                      hostEmail: profileEmail,
                      meetingType: "EBUMENYI_MEETING",
                      speaker: "",
                      attendees: 120,
                    });
                    setEditingEvent(null);
                    setShowEventModal(true);
                  }}
                  className='w-full flex items-center gap-1 md:gap-2 px-1 md:px-2 py-1 md:py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 rounded-lg transition-colors'
                >
                  <Video className='w-3 h-3 md:w-4 md:h-4 flex-shrink-0' />
                  <span className='truncate'>Webinar</span>
                </button>
                <button
                  onClick={() => {
                    setQuickActionDefaults({
                      type: "TRAINING",
                      title: "Health Workshop",
                      location: "District Health Office",
                      meetingType: "OTHER",
                      facilitator: "",
                      attendees: 25,
                    });
                    setEditingEvent(null);
                    setShowEventModal(true);
                  }}
                  className='w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 rounded-lg transition-colors'
                >
                  <Users className='w-3 h-3' />
                  Workshop
                </button>
              </div>
            </div>
          </div>

          {/* Right: Events for selected date */}
          <div className='col-span-1 md:col-span-3 lg:col-span-4 bg-white rounded-lg shadow p-2 md:p-4'>
            <div className='flex items-center justify-between mb-2 md:mb-4'>
              <h3 className='text-base md:text-lg font-semibold text-gray-900'>
                Events -{" "}
                {expandedDate.toLocaleDateString("default", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <button
                onClick={() => setExpandedDate(null)}
                className='text-gray-400 hover:text-gray-600 text-2xl'
              >
                ×
              </button>
            </div>

            {(() => {
              const dateEvents = events.filter((event: any) => {
                // Date filter
                if (
                  !event.startAt ||
                  new Date(event.startAt).toDateString() !==
                    expandedDate.toDateString()
                ) {
                  return false;
                }
                // Type filter
                if (filterType !== "all" && event.type !== filterType) {
                  return false;
                }
                // Status filter
                if (filterStatus !== "all" && event.status !== filterStatus) {
                  return false;
                }
                // Search filter
                if (searchTerm) {
                  const matchesSearch =
                    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    event.description
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()) ||
                    event.location.toLowerCase().includes(searchTerm.toLowerCase());
                  if (!matchesSearch) {
                    return false;
                  }
                }
                return true;
              });

              if (dateEvents.length === 0) {
                return (
                  <div className='text-center py-8'>
                    <p className='text-gray-500 text-xs md:text-sm'>
                      No events on this date
                    </p>
                  </div>
                );
              }

              return (
                <div className='space-y-2 md:space-y-3'>
                  {dateEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => {
                        handleViewEvent(event);
                        setExpandedDate(null);
                      }}
                      className={`p-2 md:p-3 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-shadow ${getEventTypeColor(event.type)}`}
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <div className='flex-1'>
                          <div className='flex items-center gap-1 md:gap-2'>
                            {getEventTypeIcon(event.type)}
                            <h4 className='font-medium text-xs md:text-sm text-gray-900 truncate'>
                              {event.title}
                            </h4>
                          </div>
                          <p className='text-xs text-gray-600 mt-1'>
                            {event.startAt
                              ? new Date(event.startAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                            {event.endAt
                              ? ` - ${new Date(event.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                              : ""}
                          </p>
                          {event.location && (
                            <div className='flex items-center gap-0.5 md:gap-1 text-xs text-gray-500 mt-1'>
                              <MapPin className='w-3 h-3 flex-shrink-0' />
                              <span className='truncate'>
                                {formatLocation(event.location)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div
                          className={`text-xs font-medium whitespace-nowrap ${getPriorityColor(event.priority)}`}
                        >
                          {event.priority?.toLowerCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <>
          {/* Normal grid layout - Main Calendar and Sidebar */}
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
            {/* Main Calendar */}
            <div className='lg:col-span-3'>{renderCalendarView()}</div>

            {/* Sidebar */}
            <div className='lg:col-span-1 space-y-6'>
              {/* Upcoming Events */}
              <div className='bg-white rounded-lg shadow p-4'>
                <div className='flex items-center gap-2 mb-4'>
                  <Bell className='w-5 h-5 text-gray-600' />
                  <h3 className='font-semibold text-gray-900'>Upcoming Events</h3>
                </div>

                <div className='space-y-3'>
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className='border-l-3 border-blue-500 pl-3 py-2'
                    >
                      <div className='flex items-start justify-between'>
                        <div className='flex-1'>
                          <h4 className='text-sm font-medium text-gray-900 mb-1'>
                            {event.title}
                          </h4>
                          <p className='text-xs text-gray-600 mb-1'>
                            {event.startAt
                              ? new Date(event.startAt).toLocaleDateString()
                              : ""}{" "}
                            •{" "}
                            {event.startAt
                              ? new Date(event.startAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}{" "}
                            -{" "}
                            {event.endAt
                              ? new Date(event.endAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </p>
                          <div className='flex items-center gap-1 text-xs text-gray-500'>
                            <MapPin className='w-3 h-3' />
                            {formatLocation(event.location)}
                          </div>
                        </div>
                        <div
                          className={`text-xs font-medium ${getPriorityColor(event.priority)}`}
                        >
                          {event.priority.toLowerCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Statistics */}
              <div className='bg-white rounded-lg shadow p-4'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='font-semibold text-gray-900'>This Month</h3>
                  {statsFilterType && (
                    <button
                      onClick={() => setStatsFilterType(null)}
                      className='text-sm text-blue-600 hover:text-blue-800 underline'
                    >
                      Show All
                    </button>
                  )}
                </div>

                <div className='space-y-3'>
                  {(() => {
                    // Calculate statistics for current month
                    const currentDate = new Date();
                    const currentMonth = currentDate.getMonth();
                    const currentYear = currentDate.getFullYear();

                    const monthEvents = events.filter((event) => {
                      const eventDate = event.startAt
                        ? new Date(event.startAt)
                        : null;
                      return (
                        eventDate &&
                        eventDate.getMonth() === currentMonth &&
                        eventDate.getFullYear() === currentYear
                      );
                    });

                    const stats = {
                      TRAINING: monthEvents.filter(
                        (e) => e.type?.toUpperCase() === "TRAINING",
                      ).length,
                      WEBINAR: monthEvents.filter(
                        (e) => e.type?.toUpperCase() === "WEBINAR",
                      ).length,
                      MEETING: monthEvents.filter(
                        (e) => e.type?.toUpperCase() === "MEETING",
                      ).length,
                      SCREENING: monthEvents.filter(
                        (e) => e.type?.toUpperCase() === "SCREENING",
                      ).length,
                      DRILL: monthEvents.filter(
                        (e) => e.type?.toUpperCase() === "DRILL",
                      ).length,
                    };

                    const statItems = [
                      {
                        type: "TRAINING",
                        label: "Training",
                        color: "bg-blue-500",
                        count: stats.TRAINING,
                      },
                      {
                        type: "WEBINAR",
                        label: "Webinars",
                        color: "bg-purple-500",
                        count: stats.WEBINAR,
                      },
                      {
                        type: "MEETING",
                        label: "Meetings",
                        color: "bg-gray-500",
                        count: stats.MEETING,
                      },
                      {
                        type: "SCREENING",
                        label: "Screenings",
                        color: "bg-green-500",
                        count: stats.SCREENING,
                      },
                      {
                        type: "DRILL",
                        label: "Drills",
                        color: "bg-red-500",
                        count: stats.DRILL,
                      },
                    ].filter((item) => item.count > 0);

                    return statItems.length > 0 ? (
                      statItems.map((item) => (
                        <div
                          key={item.type}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            statsFilterType === item.type
                              ? "bg-blue-50 border border-blue-200"
                              : "hover:bg-gray-50"
                          }`}
                          onClick={() =>
                            setStatsFilterType(
                              statsFilterType === item.type ? null : item.type,
                            )
                          }
                        >
                          <div className='flex items-center gap-2'>
                            <div
                              className={`w-3 h-3 ${item.color} rounded-full`}
                            ></div>
                            <span className='text-sm text-gray-600'>
                              {item.label}
                            </span>
                          </div>
                          <span className='text-sm font-medium text-gray-900'>
                            {item.count}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className='text-center text-gray-500 text-sm py-4'>
                        No events this month
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Quick Actions */}
              <div className='bg-white rounded-lg shadow p-4'>
                <h3 className='font-semibold text-gray-900 mb-4'>Quick Actions</h3>

                <div className='space-y-2'>
                  <button
                    onClick={() => {
                      setQuickActionDefaults({
                        type: "TRAINING",
                        title: "Training Session",
                        location: "Kigali Health Center",
                        meetingType: "OTHER",
                        instructor: "",
                        attendees: 15,
                      });
                      setEditingEvent(null);
                      setShowEventModal(true);
                    }}
                    className='w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg'
                  >
                    <GraduationCap className='w-4 h-4' />
                    Schedule Training
                  </button>
                  <button
                    onClick={() => {
                      setQuickActionDefaults({
                        type: "SCREENING",
                        title: "Health Screening",
                        location: "Community Health Center",
                        meetingType: "OTHER",
                        coordinator: "",
                        attendees: 45,
                      });
                      setEditingEvent(null);
                      setShowEventModal(true);
                    }}
                    className='w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg'
                  >
                    <ClipboardCheck className='w-4 h-4' />
                    Plan Screening
                  </button>
                  <button
                    onClick={() => {
                      setQuickActionDefaults({
                        type: "WEBINAR",
                        title: "Health Webinar",
                        hostEmail: profileEmail,
                        meetingType: "EBUMENYI_MEETING",
                        speaker: "",
                        attendees: 120,
                      });
                      setEditingEvent(null);
                      setShowEventModal(true);
                    }}
                    className='w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg'
                  >
                    <Video className='w-4 h-4' />
                    Create Webinar
                  </button>
                  <button
                    onClick={() => {
                      setQuickActionDefaults({
                        type: "TRAINING",
                        title: "Health Workshop",
                        location: "District Health Office",
                        meetingType: "OTHER",
                        facilitator: "",
                        attendees: 25,
                      });
                      setEditingEvent(null);
                      setShowEventModal(true);
                    }}
                    className='w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg'
                  >
                    <Users className='w-4 h-4' />
                    Organize Workshop
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Event Details Modal */}
      {showDetailsModal && selectedEvent && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20'>
          <div className='bg-white rounded-lg shadow-xl p-6 max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide'>
            <div className='flex items-center justify-between mb-6'>
              <h3 className='text-2xl font-semibold text-gray-900'>
                {selectedEvent.title}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className='text-gray-400 hover:text-gray-600 text-2xl'
              >
                ×
              </button>
            </div>

            <div className='space-y-6'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div>
                  <h4 className='font-semibold text-gray-900 mb-3'>Event Details</h4>
                  <div className='space-y-3'>
                    <div className='flex items-center gap-3'>
                      <CalendarIcon className='w-5 h-5 text-gray-400' />
                      <span className='text-gray-700'>
                        {selectedEvent.startAt
                          ? new Date(selectedEvent.startAt).toLocaleDateString(
                              "en-US",
                              {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              },
                            )
                          : ""}
                      </span>
                    </div>
                    <div className='flex items-center gap-3'>
                      <Clock className='w-5 h-5 text-gray-400' />
                      <span className='text-gray-700'>
                        {selectedEvent.startAt
                          ? new Date(selectedEvent.startAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}{" "}
                        -{" "}
                        {selectedEvent.endAt
                          ? new Date(selectedEvent.endAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                    <div className='flex items-center gap-3'>
                      {selectedEvent.meetingType === "OTHER" ? (
                        <MapPin className='w-5 h-5 text-gray-400' />
                      ) : (
                        <Video className='w-5 h-5 text-gray-400' />
                      )}
                      {selectedEvent.meetingType === "OTHER" ? (
                        <span className='text-gray-700'>
                          {formatLocation(selectedEvent.location)}
                        </span>
                      ) : (
                        <div className='flex items-center gap-2'>
                          <span className='text-gray-700'>
                            {formatLocation(selectedEvent.location)}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedEvent.location);
                              toast.success("Link copied to clipboard");
                            }}
                            className='text-gray-500 hover:text-gray-700 p-1'
                            title='Copy link'
                          >
                            <Copy className='w-4 h-4' />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className='flex items-center gap-3'>
                      <Users className='w-5 h-5 text-gray-400' />
                      <span className='text-gray-700'>
                        {(selectedEvent.participants?.length || 0) +
                          (selectedEvent.externalParticipants?.length || 0)}{" "}
                        total participants
                        {selectedEvent.participants?.length > 0 &&
                          selectedEvent.externalParticipants?.length > 0 &&
                          ` (${selectedEvent.participants.length} internal + ${selectedEvent.externalParticipants.length} external)`}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className='font-semibold text-gray-900 mb-3'>Event Info</h4>
                  <div className='space-y-3'>
                    <div>
                      <span className='text-sm text-gray-500'>Type:</span>
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ml-2 ${getEventTypeColor(selectedEvent.type)}`}
                      >
                        {getEventTypeIcon(selectedEvent.type)}
                        {selectedEvent.type}
                      </div>
                    </div>
                    <div>
                      <span className='text-sm text-gray-500'>Status:</span>
                      <span className='ml-2'>
                        {getStatusBadge(
                          selectedEvent.startAt && selectedEvent.endAt
                            ? getEventStatus(
                                selectedEvent.startAt,
                                selectedEvent.endAt,
                              )
                            : "scheduled",
                        )}
                      </span>
                    </div>
                    <div>
                      <span className='text-sm text-gray-500'>Priority:</span>
                      <span
                        className={`ml-2 font-medium ${getPriorityColor(selectedEvent.priority)}`}
                      >
                        {selectedEvent.priority.toLowerCase()}
                      </span>
                    </div>
                    {selectedEvent.instructor && (
                      <div>
                        <span className='text-sm text-gray-500'>Instructor:</span>
                        <span className='ml-2 text-gray-700'>
                          {selectedEvent.instructor}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Attendees List */}
              {((selectedEvent.participants &&
                selectedEvent.participants.length > 0) ||
                (selectedEvent.externalParticipants &&
                  selectedEvent.externalParticipants.length > 0)) && (
                <div>
                  <h4 className='font-semibold text-gray-900 mb-3'>
                    Participants (
                    {(selectedEvent.participants?.length || 0) +
                      (selectedEvent.externalParticipants?.length || 0)}
                    )
                  </h4>

                  {/* Internal Attendees */}
                  {selectedEvent.participants &&
                    selectedEvent.participants.length > 0 && (
                      <div className='mb-4'>
                        <h5 className='text-sm font-medium text-gray-700 mb-2'>
                          Internal Attendees ({selectedEvent.participants.length})
                        </h5>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'>
                          {selectedEvent.participants.map((participant: any) => (
                            <div
                              key={participant.id}
                              className='flex items-center gap-3 p-2 bg-gray-50 rounded-lg'
                            >
                              <div className='w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center'>
                                <span className='text-sm font-medium text-blue-800'>
                                  {participant.user?.fullNames
                                    ?.split(" ")
                                    .map((n: string) => n[0])
                                    .join("") || "?"}
                                </span>
                              </div>
                              <div>
                                <div className='font-medium text-sm'>
                                  {participant.user?.fullNames || "Unknown"}
                                </div>
                                <div className='text-xs text-gray-600'>
                                  {participant.role || "Attendee"} •{" "}
                                  {participant.user?.phoneNumber || ""}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* External Participants */}
                  {selectedEvent.externalParticipants &&
                    selectedEvent.externalParticipants.length > 0 && (
                      <div>
                        <h5 className='text-sm font-medium text-gray-700 mb-2'>
                          External Participants (
                          {selectedEvent.externalParticipants.length})
                        </h5>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'>
                          {selectedEvent.externalParticipants.map(
                            (participant: any, index: number) => (
                              <div
                                key={index}
                                className='flex items-center gap-3 p-2 bg-orange-50 rounded-lg'
                              >
                                <div className='w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center'>
                                  <span className='text-sm font-medium text-orange-800'>
                                    {participant.email &&
                                    typeof participant.email === "string" &&
                                    participant.email.length > 0
                                      ? participant.email.charAt(0).toUpperCase()
                                      : "?"}
                                  </span>
                                </div>
                                <div>
                                  <div className='font-medium text-sm'>
                                    {participant.email || "Unknown"}
                                  </div>
                                  <div className='text-xs text-gray-600'>
                                    External • Email invitation
                                  </div>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {(selectedEvent.reminderMinutesBefore?.length > 0 ||
                selectedEvent.attachments?.length > 0 ||
                selectedEvent.frequency !== "NONE") && (
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                  {selectedEvent.frequency !== "NONE" && (
                    <div>
                      <h4 className='font-semibold text-gray-900 mb-3'>Repeats</h4>
                      <p className='text-sm text-gray-700'>
                        {selectedEvent.frequency}
                        {selectedEvent.daysOfWeek?.length
                          ? ` on ${selectedEvent.daysOfWeek.map((d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}`
                          : ""}
                        {selectedEvent.recurrenceEndsAt
                          ? ` until ${new Date(selectedEvent.recurrenceEndsAt).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                  )}
                  {selectedEvent.reminderMinutesBefore?.length > 0 && (
                    <div>
                      <h4 className='font-semibold text-gray-900 mb-3'>Reminders</h4>
                      <div className='flex flex-wrap gap-2'>
                        {selectedEvent.reminderMinutesBefore.map((r: number) => (
                          <span
                            key={r}
                            className='px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm'
                          >
                            {r} min before
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedEvent.attachments?.length > 0 && (
                    <div>
                      <h4 className='font-semibold text-gray-900 mb-3'>
                        Attachments
                      </h4>
                      <div className='space-y-2'>
                        {selectedEvent.attachments.map((att: any, index: number) => {
                          const isImage = isImageUrl(att.url);
                          return (
                            <div
                              key={index}
                              className='flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 hover:border-primary/70 hover:shadow-sm transition'
                            >
                              {isImage ? (
                                <img
                                  src={att.url}
                                  alt={att.name || "Attachment preview"}
                                  className='w-14 h-14 rounded-lg object-cover border border-slate-200'
                                />
                              ) : (
                                <div className='w-14 h-14 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 flex items-center justify-center'>
                                  <FileText className='w-5 h-5' />
                                </div>
                              )}
                              <div className='flex-1 min-w-0'>
                                <div className='font-medium text-sm text-slate-900 truncate'>
                                  {att.name || "Attachment"}
                                </div>
                                <a
                                  href={att.url}
                                  target='_blank'
                                  rel='noreferrer'
                                  className='text-xs text-primary hover:underline break-all'
                                >
                                  {isImage ? "Open preview" : "Open file"}
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h4 className='font-semibold text-gray-900 mb-3'>Description</h4>
                <p className='text-gray-700 leading-relaxed'>
                  {selectedEvent.description}
                </p>
              </div>

              <div className='flex items-center justify-end gap-3 pt-6 border-t flex-wrap'>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  disabled={deleteEventMutation.isPending}
                  className='px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Close
                </button>
                {isAdmin && selectedEvent.meetingType === 'EBUMENYI_MEETING' && (
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      navigate(`/attendance/${selectedEvent.id}`);
                    }}
                    className='flex items-center gap-2 px-4 py-2 bg-blue-50 text-primary border border-primary/20 rounded-lg font-medium hover:bg-blue-100 transition-colors'
                  >
                    <Users className='w-4 h-4' />
                    Attendance
                  </button>
                )}
                {selectedEvent.amOwner && (
                  <>
                    <button
                      onClick={() => handleDeleteEvent(selectedEvent)}
                      disabled={deleteEventMutation.isPending}
                      className='px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      <Trash2 className='w-4 h-4 inline mr-2' />{" "}
                      {deleteEventMutation.isPending ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingEvent(selectedEvent);
                        setShowEventModal(true);
                        setShowDetailsModal(false);
                      }}
                      disabled={
                        deleteEventMutation.isPending ||
                        updateEventMutation.isPending
                      }
                      className='px-4 py-2  bg-primary text-white rounded-lg  font-medium hover:bg-[#4d81d2] disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      <Edit className='w-4 h-4  inline mr-2' />{" "}
                      {updateEventMutation.isPending ? "Loading..." : "Edit"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Event Modal */}
      {showEventModal && (
        <div className='fixed inset-0 bg-gradient-to-br from-slate-900/70 via-slate-900/60 to-blue-900/50 backdrop-blur-sm flex items-center justify-center z-20'>
          <div className='bg-white/90 backdrop-blur-2xl border border-white/60 shadow-2xl rounded-3xl p-6 max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide'>
            <div className='flex items-center justify-between mb-6'>
              <h3 className='text-2xl font-semibold text-gray-900'>
                {editingEvent ? "Edit Event" : "Create New Event"}
              </h3>
              <button
                onClick={() => {
                  setShowEventModal(false);
                  setEditingEvent(null);
                  setQuickActionDefaults(null);
                  setSelectedDateForForm(null);
                  setFormDate("");
                  setSelectedMeetingType("EBUMENYI_MEETING");
                  setFrequency("NONE");
                  setIsRepeating(false);
                  setDaysOfWeek([]);
                  setRecurrenceEnd("");
                  setSelectedAttendees([]);
                  setExternalParticipants([]);
                  setExternalEmailInput("");
                  setAttendeeSearchTerm("");
                  setAttendeeFilterRole("all");
                  setAttendeeFilterHospital("all");
                  setAttendeeFilterDistrict("all");
                  setAttendeeFilterSector("all");
                  setAttendeeFilterCell("all");
                  setAttendeeFilterVillage("all");
                  setReminders([30]);
                  setReminderInput("");
                  setAttachments([]);
                  setAttachmentUrl("");
                  setIsUploadingAttachment(false);
                }}
                className='text-gray-400 hover:text-gray-600 text-2xl'
              >
                ×
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const startTime = formData.get("startTime") as string;
                const endTime = formData.get("endTime") as string;
                const timeRange =
                  startTime && endTime ? `${startTime} - ${endTime}` : startTime;

                const eventData = {
                  title: formData.get("title"),
                  type: formData.get("type"),
                  date: new Date(formData.get("date") as string),
                  time: timeRange,
                  location:
                    editingEvent &&
                    formData.get("meetingType") === "EBUMENYI_MEETING"
                      ? editingEvent.location
                      : formData.get("location"),
                  hostEmail: formData.get("hostEmail"),
                  meetingType: formData.get("meetingType"),
                  description: formData.get("description"),
                  priority: formData.get("priority"),
                  attendees: selectedAttendees,
                  externalParticipants: externalParticipants,
                  reminders,
                  attachments,
                  frequency,
                  daysOfWeek,
                  recurrenceEndsAt: recurrenceEnd ? new Date(recurrenceEnd) : null,
                };

                // If editing a recurring event, show occurrence mode dialog first
                if (
                  editingEvent &&
                  editingEvent.isRepeating &&
                  editingEvent.commonId
                ) {
                  setOccurrenceActionType("edit");
                  setShowOccurrenceActionDialog(true);
                  // Store the event data temporarily for use after mode selection
                  (window as any).__pendingEditData = {
                    ...eventData,
                    id: editingEvent.id,
                  };
                  return;
                }

                const success = await handleCreateEvent({
                  ...eventData,
                  ...(editingEvent ? { id: editingEvent.id } : {}),
                });

                // Only clear form if submission was successful
                if (success) {
                  setQuickActionDefaults(null);
                  setSelectedDateForForm(null);
                  setFormDate("");
                  setSelectedMeetingType("EBUMENYI_MEETING");
                  setFrequency("NONE");
                  setIsRepeating(false);
                  setDaysOfWeek([]);
                  setRecurrenceEnd("");
                  setSelectedAttendees([]);
                  setExternalParticipants([]);
                  setExternalEmailInput("");
                  setReminders([30]);
                  setReminderInput("");
                  setAttachments([]);
                  setAttachmentUrl("");
                  setIsUploadingAttachment(false);
                  setAttendeeSearchTerm("");
                  setAttendeeFilterRole("all");
                  setAttendeeFilterHospital("all");
                  setAttendeeFilterDistrict("all");
                  setAttendeeFilterSector("all");
                  setAttendeeFilterCell("all");
                  setAttendeeFilterVillage("all");
                }
              }}
            >
              <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-2'>
                  <TextField
                    label='Event Title *'
                    type='text'
                    name='title'
                    defaultValue={
                      editingEvent?.title || quickActionDefaults?.title || ""
                    }
                    placeholder='Enter event title'
                  />

                  <div>
                    <OptionsField
                      label='Event Type *'
                      name='type'
                      options={[
                        { value: "TRAINING", label: "Training" },
                        { value: "WEBINAR", label: "Webinar" },
                        { value: "MEETING", label: "Meeting" },
                        { value: "SCREENING", label: "Screening" },
                        { value: "DRILL", label: "Drill" },
                      ]}
                      value={selectedEventType}
                      onChange={(value) => setSelectedEventType(value)}
                      defaultLabel='Select event type...'
                      required={true}
                    />
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-2'>
                  <OptionsField
                    label='Meeting Type *'
                    name='meetingType'
                    options={[
                      { value: "GOOGLE_MEET", label: "Google Meet" },
                      { value: "ZOOM", label: "Zoom" },
                      { value: "EBUMENYI_MEETING", label: "eBumenyi Meeting" },
                      { value: "OTHER", label: "Physical Address" },
                    ]}
                    value={selectedMeetingType}
                    onChange={(value) => setSelectedMeetingType(value)}
                    defaultLabel='Select meeting type...'
                    required={true}
                  />

                  <div>
                    <OptionsField
                      label='Priority'
                      name='priority'
                      options={[
                        { value: "LOW", label: "Low" },
                        { value: "MEDIUM", label: "Medium" },
                        { value: "HIGH", label: "High" },
                        { value: "URGENT", label: "Urgent" },
                      ]}
                      defaultValue={editingEvent?.priority || "MEDIUM"}
                      defaultLabel='Select priority...'
                      required={false}
                    />
                  </div>
                  {selectedMeetingType === "OTHER" ? (
                    <TextField
                      label='Physical Address *'
                      type='text'
                      name='location'
                      defaultValue={
                        editingEvent?.location || quickActionDefaults?.location || ""
                      }
                      placeholder='Enter physical address'
                    />
                  ) : selectedMeetingType === "EBUMENYI_MEETING" ? (
                    <TextField
                      label='Host Email *'
                      type='email'
                      name='hostEmail'
                      defaultValue={
                        profileEmail ||
                        editingEvent?.hostEmail ||
                        quickActionDefaults?.hostEmail ||
                        ""
                      }
                      placeholder='Enter host email address'
                    />
                  ) : (
                    <TextField
                      label='Meeting Link *'
                      type='url'
                      name='location'
                      defaultValue={
                        editingEvent?.location || quickActionDefaults?.location || ""
                      }
                      placeholder='Enter meeting link'
                    />
                  )}

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Date{" "}
                      {editingEvent?.isRepeating && (
                        <span className='text-xs text-gray-500'>
                          (read-only for repeating events)
                        </span>
                      )}
                      *
                    </label>
                    <input
                      type='date'
                      name='date'
                      min={getTodayDate()}
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      disabled={editingEvent?.isRepeating}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        editingEvent?.isRepeating
                          ? "bg-gray-100 cursor-not-allowed opacity-60"
                          : ""
                      }`}
                      required
                    />
                  </div>
                  <TextField
                    label='Start Time *'
                    type='time'
                    name='startTime'
                    defaultValue={
                      editingEvent?.startAt
                        ? new Date(editingEvent.startAt).toTimeString().slice(0, 5)
                        : getDefaultTime()
                    }
                  />
                  <TextField
                    label='End Time *'
                    type='time'
                    name='endTime'
                    defaultValue={
                      editingEvent?.endAt
                        ? new Date(editingEvent.endAt).toTimeString().slice(0, 5)
                        : getEndTime(
                            editingEvent?.startAt
                              ? new Date(editingEvent.startAt)
                                  .toTimeString()
                                  .slice(0, 5)
                              : getDefaultTime(),
                          )
                    }
                  />
                </div>
              </div>

              {/* Recurrence */}
              <div className='mt-4 rounded-3xl border border-white/70 bg-gradient-to-br from-white via-slate-50 to-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.2)] p-4'>
                <div className='flex items-center justify-between mb-4'>
                  <div>
                    <p className='text-[11px] uppercase tracking-[0.08em] text-slate-500'>
                      Repeat
                    </p>
                    <h4 className='text-lg font-semibold text-slate-900'>
                      Plan cadence
                    </h4>
                  </div>
                  <div className='bg-slate-100 rounded-full p-1 flex gap-1'>
                    <button
                      type='button'
                      onClick={() => {
                        setIsRepeating(false);
                        setFrequency("NONE");
                        setDaysOfWeek([]);
                        setRecurrenceEnd("");
                      }}
                      className={`px-3 py-1.5 text-sm rounded-full transition ${
                        !isRepeating
                          ? "bg-white shadow text-slate-900"
                          : "text-slate-600"
                      }`}
                    >
                      Do not repeat
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        setIsRepeating(true);
                        if (frequency === "NONE") setFrequency("DAILY");
                      }}
                      className={`px-3 py-1.5 text-sm rounded-full transition ${
                        isRepeating
                          ? "bg-white shadow text-slate-900"
                          : "text-slate-600"
                      }`}
                    >
                      Repeat
                    </button>
                  </div>
                </div>

                {isRepeating && (
                  <div className='space-y-4'>
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                      <OptionsField
                        label='Frequency'
                        name='frequency'
                        options={[
                          { value: "DAILY", label: "Daily" },
                          { value: "WEEKLY", label: "Weekly" },
                        ]}
                        value={frequency === "NONE" ? "DAILY" : frequency}
                        onChange={(val) => {
                          setFrequency(val);
                          setIsRepeating(true);
                        }}
                        defaultLabel='Choose frequency...'
                        required={false}
                      />
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-1'>
                          Ends On{" "}
                          {isRepeating && <span className='text-red-500'>*</span>}
                          {editingEvent?.isRepeating &&
                            occurrenceActionMode === "single" && (
                              <span className='text-xs text-gray-500'>
                                (read-only)
                              </span>
                            )}
                          {editingEvent?.isRepeating &&
                            (occurrenceActionMode === "all" ||
                              occurrenceActionMode === "future") && (
                              <span className='text-xs text-blue-600'>
                                (editable - change to expand/reduce range)
                              </span>
                            )}
                        </label>
                        <input
                          type='date'
                          value={recurrenceEnd}
                          min={formDate || getTodayDate()}
                          onChange={(e) => setRecurrenceEnd(e.target.value)}
                          disabled={
                            editingEvent?.isRepeating &&
                            occurrenceActionMode === "single"
                          }
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            editingEvent?.isRepeating &&
                            occurrenceActionMode === "single"
                              ? "bg-gray-100 cursor-not-allowed opacity-60"
                              : ""
                          }`}
                          required={isRepeating}
                        />
                      </div>
                    </div>

                    {frequency === "WEEKLY" && (
                      <div>
                        <p className='text-sm text-slate-600 mb-2'>Repeat on</p>
                        <div className='grid grid-cols-7 gap-2'>
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                            (label, idx) => (
                              <button
                                key={label}
                                type='button'
                                onClick={() => toggleDayOfWeek(idx)}
                                className={`py-2 rounded-xl border text-sm ${
                                  daysOfWeek.includes(idx)
                                    ? "bg-primary text-white border-primary"
                                    : "border-slate-200 text-slate-700 hover-border-primary/60"
                                }`}
                              >
                                {label}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                    {frequency === "MONTHLY" && (
                      <div className='flex items-center gap-3 text-sm text-slate-700 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl'>
                        <Clock className='w-4 h-4 text-primary' />
                        Occurs on day{" "}
                        {formDate ? Number(formDate.split("-")[2]) : "—"} of every
                        month
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Reminders & Attachments */}
              <div className='mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4'>
                <div className='rounded-2xl border border-slate-100 bg-gradient-to-br from-white via-slate-50 to-white shadow-inner p-4'>
                  <div className='flex items-center justify-between mb-3'>
                    <div>
                      <p className='text-[11px] uppercase tracking-[0.08em] text-slate-500'>
                        Reminders
                      </p>
                      <h4 className='text-lg font-semibold text-slate-900'>
                        Alert me before
                      </h4>
                    </div>
                  </div>
                  <div className='flex flex-wrap gap-2 mb-3'>
                    {quickReminderOptions.map((opt) => (
                      <button
                        key={opt.label}
                        type='button'
                        onClick={() => handleAddReminder(opt.minutes)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          reminders.includes(opt.minutes)
                            ? "bg-primary text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className='flex items-center gap-2 mb-3'>
                    <input
                      type='number'
                      min={1}
                      value={reminderInput}
                      onChange={(e) => setReminderInput(e.target.value)}
                      placeholder='Custom (e.g., 45m, 2h, 1d)'
                      className='flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary text-sm'
                    />
                    <button
                      type='button'
                      onClick={() => handleAddReminder()}
                      className='px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium shadow-sm hover:bg-[#4d81d2]'
                    >
                      Add
                    </button>
                  </div>
                  {reminders.length > 0 && (
                    <div className='flex flex-wrap gap-2'>
                      {reminders.map((r) => (
                        <div
                          key={r}
                          className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 text-white text-sm shadow'
                        >
                          <span>{formatMinutesLabel(r)}</span>
                          <button
                            type='button'
                            onClick={() => handleRemoveReminder(r)}
                            className='text-white/80 hover:text-white'
                            aria-label='Remove reminder'
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className='rounded-2xl border border-slate-100 bg-gradient-to-br from-white via-slate-50 to-white shadow-inner p-4'>
                  <div className='flex items-center justify-between mb-3'>
                    <div>
                      <p className='text-[11px] uppercase tracking-[0.08em] text-slate-500'>
                        Attachments
                      </p>
                      <h4 className='text-lg font-semibold text-slate-900'>
                        Add docs & links
                      </h4>
                    </div>
                    <span className='px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-700'>
                      Optional
                    </span>
                  </div>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleUploadFiles(e.dataTransfer.files);
                    }}
                    className='mb-3 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-sm text-slate-600 bg-slate-50 hover:border-primary/60 transition'
                  >
                    <p className='font-medium text-slate-800'>Drag & drop files</p>
                    <p className='text-xs text-slate-500 mb-2'>Images, PDFs, docs</p>
                    <label className='px-3 py-2 bg-primary text-white rounded-xl shadow cursor-pointer'>
                      <input
                        type='file'
                        multiple
                        className='hidden'
                        onChange={(e) => handleUploadFiles(e.target.files)}
                      />
                      {isUploadingAttachment ? "Uploading..." : "Choose files"}
                    </label>
                  </div>

                  <div className='mb-3'>
                    <input
                      type='url'
                      value={attachmentUrl}
                      onChange={(e) => setAttachmentUrl(e.target.value)}
                      placeholder='Paste a link (image, PDF, doc...)'
                      className='w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary text-sm'
                    />
                  </div>
                  <button
                    type='button'
                    onClick={handleAddAttachment}
                    className='w-full mb-3 px-4 py-2 rounded-xl border border-dashed border-slate-300 text-sm text-slate-700 hover:border-primary hover:text-primary transition-colors'
                  >
                    + Add attachment
                  </button>
                  {attachments.length > 0 && (
                    <div className='space-y-2'>
                      {attachments.map((att, index) => (
                        <div
                          key={`${att.url}-${index}`}
                          className='flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-100 text-sm border border-slate-200'
                        >
                          {isImageUrl(att.url) ? (
                            <img
                              src={att.url}
                              alt={att.name || "Attachment preview"}
                              className='w-12 h-12 rounded-lg object-cover border border-slate-200'
                            />
                          ) : (
                            <div className='w-12 h-12 rounded-lg border border-slate-200 bg-white text-slate-500 flex items-center justify-center'>
                              <FileText className='w-4 h-4' />
                            </div>
                          )}
                          <div className='flex-1 min-w-0'>
                            <span className='font-medium text-slate-900 truncate block'>
                              {att.name || getAttachmentLabel(att.url)}
                            </span>
                            <a
                              href={att.url}
                              target='_blank'
                              rel='noreferrer'
                              className='text-primary hover:underline break-all'
                            >
                              {isImageUrl(att.url) ? "Open preview" : "Open file"}
                            </a>
                          </div>
                          <button
                            type='button'
                            onClick={() => handleRemoveAttachment(index)}
                            className='text-slate-500 hover:text-red-500 text-lg'
                            aria-label='Remove attachment'
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Attendees Selection */}
              <div className='mt-6'>
                <label className='block text-sm font-medium text-gray-700 mb-3'>
                  Select Attendees
                </label>

                {/* Quick Select Buttons */}
                <div className='grid grid-cols-2 md:grid-cols-4 gap-2 mb-4'>
                  <TextField
                    type='text'
                    placeholder='Search by name or phone'
                    value={attendeeSearchTerm}
                    onChange={(e) => setAttendeeSearchTerm(e.target.value)}
                    additionalClass='px-3 py-2 text-sm'
                  />
                  <button
                    type='button'
                    onClick={handleSelectAllFiltered}
                    className={`px-3 py-1 rounded-lg text-sm ${isAllFilteredSelected() ? "bg-primary text-white" : "bg-gray-100 text-gray-800"}`}
                  >
                    {isAllFilteredSelected()
                      ? "Unselect Filtered"
                      : "Select Filtered"}
                  </button>
                  <button
                    type='button'
                    onClick={handleSelectAllCHW}
                    className={`px-3 py-1 rounded-lg text-sm ${isAllCHWSelected() ? "bg-primary text-white" : "bg-gray-100 text-gray-800"}`}
                  >
                    {isAllCHWSelected() ? "All CHWs" : "Select All CHW"}
                  </button>
                  <button
                    type='button'
                    onClick={handleSelectAllTrainer}
                    className={`px-3 py-1 rounded-lg text-sm ${isAllTrainersSelected() ? "bg-primary text-white" : "bg-gray-100 text-gray-800"}`}
                  >
                    {isAllTrainersSelected()
                      ? "All Trainers"
                      : "Select All Trainers"}
                  </button>
                </div>

                {/* Filters */}
                <div className='grid grid-cols-2 md:grid-cols-4 gap-2 mb-4'>
                  <OptionsField
                    options={[
                      { value: "all", label: "All Roles" },
                      { value: "CHW", label: "Trainee" },
                      { value: "TRAINER", label: "Trainer" },
                    ]}
                    value={attendeeFilterRole}
                    onChange={(value) => setAttendeeFilterRole(value)}
                    defaultLabel='Select role'
                    required={false}
                  />
                  <ComboboxField
                    options={[
                      { value: "all", label: "All Hospitals" },
                      ...hospitalFilterOptions,
                    ]}
                    defaultValue={attendeeFilterHospital}
                    onChange={(value) => setAttendeeFilterHospital(value)}
                    hideQueryOnChange={false}
                    placeholder='Select hospital...'
                  />
                  <ComboboxField
                    options={[
                      { value: "all", label: "All Districts" },
                      ...[
                        ...new Set(users.map((u) => u.district).filter(Boolean)),
                      ].map((district) => ({
                        value: district,
                        label: district,
                      })),
                    ]}
                    defaultValue={attendeeFilterDistrict}
                    onChange={(value) => setAttendeeFilterDistrict(value)}
                    hideQueryOnChange={false}
                    placeholder='Select district...'
                  />
                  <ComboboxField
                    options={[
                      { value: "all", label: "All Sectors" },
                      ...[
                        ...new Set(users.map((u) => u.sector).filter(Boolean)),
                      ].map((sector) => ({
                        value: sector!,
                        label: sector!,
                      })),
                    ]}
                    defaultValue={attendeeFilterSector}
                    onChange={(value) => setAttendeeFilterSector(value)}
                    hideQueryOnChange={false}
                    placeholder='Select sector...'
                  />
                </div>

                {/* User List */}
                <div className='max-h-48 overflow-y-auto border border-gray-300 rounded-lg'>
                  {getFilteredUsers().map((user) => (
                    <div
                      key={user.id}
                      className='flex items-center gap-3 p-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0'
                    >
                      <input
                        type='checkbox'
                        checked={selectedAttendees.includes(user.id)}
                        onChange={() => handleAttendeeToggle(user.id)}
                        className='w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-blue-500'
                      />
                      <div className='flex-1'>
                        <div className='font-medium text-sm'>{user.fullNames}</div>
                        <div className='text-xs text-gray-600'>
                          {user.userRoles[0]?.name} •{" "}
                          {user.hospital?.name || "No hospital"} • {user.phoneNumber}
                        </div>
                        <div className='text-xs text-gray-500'>
                          {user.district}, {user.sector}, {user.cell}, {user.village}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Selected Count */}
                <div className='mt-2 text-sm text-gray-600'>
                  {selectedAttendees.length} internal attendees +{" "}
                  {externalParticipants.length} external participants selected
                </div>
              </div>

              {/* External Participants Section */}
              <div className='mt-6'>
                <label className='block text-sm font-medium text-gray-700 mb-3'>
                  External Participants (by Email)
                </label>

                {/* Add External Participant */}
                <div className='flex gap-2 mb-4'>
                  <div className='flex-1'>
                    <input
                      type='email'
                      value={externalEmailInput}
                      onChange={(e) => setExternalEmailInput(e.target.value)}
                      onKeyPress={handleExternalEmailKeyPress}
                      placeholder='Enter email address...'
                      className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm'
                    />
                  </div>
                  <button
                    type='button'
                    onClick={handleAddExternalParticipant}
                    className='px-4 py-2 bg-primary text-white rounded-lg hover:bg-[#4d81d2] text-sm font-medium whitespace-nowrap'
                  >
                    Add Email
                  </button>
                </div>

                {/* External Participants List */}
                {externalParticipants.length > 0 && (
                  <div className='border border-gray-300 rounded-lg max-h-32 overflow-y-auto'>
                    {externalParticipants.map((email: string, index: number) => (
                      <div
                        key={index}
                        className='flex items-center justify-between p-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0'
                      >
                        <span className='text-sm text-gray-700'>{email}</span>
                        <button
                          type='button'
                          onClick={() => handleRemoveExternalParticipant(email)}
                          className='p-1 text-red-600 hover:text-red-800 rounded'
                          title='Remove participant'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className='mt-2 text-xs text-gray-500'>
                  External participants will receive meeting invitations via email
                </div>
              </div>

              <TextArea
                label='Description *'
                name='description'
                value={editingEvent?.description || ""}
                rows={4}
                placeholder='Detailed description of the event'
              />

              <div className='flex items-center justify-end gap-3 mt-8 pt-6 border-t'>
                <button
                  type='button'
                  onClick={() => {
                    setShowEventModal(false);
                    setEditingEvent(null);
                    setQuickActionDefaults(null);
                    setSelectedDateForForm(null);
                    setFormDate("");
                    setSelectedMeetingType("EBUMENYI_MEETING");
                    setFrequency("NONE");
                    setIsRepeating(false);
                    setDaysOfWeek([]);
                    setRecurrenceEnd("");
                    setExternalParticipants([]);
                    setExternalEmailInput("");
                    setReminders([30]);
                    setReminderInput("");
                    setAttachments([]);
                    setAttachmentUrl("");
                    setIsUploadingAttachment(false);
                  }}
                  className='px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200'
                >
                  Cancel
                </button>
                <Button
                  type='submit'
                  disabled={
                    createEventMutation.isPending ||
                    updateEventMutation.isPending ||
                    isCreatingMeeting
                  }
                  className='px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-[#4d81d2] disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {isCreatingMeeting
                    ? "Creating Meeting..."
                    : createEventMutation.isPending || updateEventMutation.isPending
                      ? "Saving..."
                      : editingEvent
                        ? "Update Event"
                        : "Create Event"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sign In Modal */}
      {showSignInModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30'>
          <div className='bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-xl font-semibold text-gray-900'>
                Meeting System Issue
              </h3>
              <button
                onClick={() => setShowSignInModal(false)}
                className='text-gray-400 hover:text-gray-600 text-2xl'
              >
                ×
              </button>
            </div>

            <div className='space-y-4'>
              <div className='flex items-start gap-3'>
                <AlertCircle className='w-6 h-6 text-yellow-500 mt-0.5' />
                <div>
                  <p className='text-gray-700 mb-2'>
                    There seems to be an issue with the meeting system. This could be
                    because:
                  </p>
                  <ul className='text-sm text-gray-600 space-y-1 ml-4'>
                    <li>• You don't have an eBumenyi meeting account</li>
                    <li>• You're not logged in to eBumenyi meeting</li>
                    <li>• There might be a temporary service issue</li>
                  </ul>
                </div>
              </div>

              <div className='bg-blue-50 p-4 rounded-lg'>
                <p className='text-sm text-blue-800'>
                  Please check your eBumenyi meeting sign-in status. If you don't
                  have an account, you'll need to create one to schedule virtual
                  meetings.
                </p>
              </div>
            </div>

            <div className='flex items-center justify-end gap-3 mt-6'>
              <button
                onClick={() => setShowSignInModal(false)}
                className='px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200'
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  window.open("http://localhost:3000/sign-in", "_blank");
                  setShowSignInModal(false);
                }}
                className='px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-900'
              >
                Go to Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Only for non-recurring events */}
      {eventToDelete && !(eventToDelete.isRepeating && eventToDelete.commonId) && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30'>
          <div className='bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-xl font-semibold text-gray-900'>Delete Event</h3>
              <button
                onClick={() => setEventToDelete(null)}
                className='text-gray-400 hover:text-gray-600 text-2xl'
              >
                ×
              </button>
            </div>

            <div className='space-y-4'>
              <div className='flex items-start gap-3'>
                <AlertCircle className='w-6 h-6 text-red-500 mt-0.5' />
                <div>
                  <p className='text-gray-700 mb-2'>
                    Are you sure you want to delete this event?
                  </p>
                  <div className='bg-gray-50 p-3 rounded-lg'>
                    <p className='font-medium text-gray-900'>
                      {eventToDelete.title}
                    </p>
                    <p className='text-sm text-gray-600'>
                      {eventToDelete.startAt
                        ? new Date(eventToDelete.startAt).toLocaleDateString()
                        : ""}{" "}
                      at{" "}
                      {eventToDelete.startAt
                        ? new Date(eventToDelete.startAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                  <p className='text-sm text-gray-600 mt-2'>
                    This action cannot be undone.{" "}
                    {eventToDelete.meetingType === "EBUMENYI_MEETING"
                      ? "The meeting link will also be deleted."
                      : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className='flex items-center justify-end gap-3 mt-6'>
              <button
                onClick={() => setEventToDelete(null)}
                className='px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200'
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteEvent}
                disabled={deleteEventMutation.isPending}
                className='px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {deleteEventMutation.isPending ? "Deleting..." : "Delete Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Occurrence Action Dialog (Edit or Delete recurring event) */}
      {showOccurrenceActionDialog && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30'>
          <div className='bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4'>
            <h3 className='text-lg font-bold text-gray-900 mb-2'>
              {occurrenceActionType === "delete"
                ? "Delete this event?"
                : "Update this event?"}
            </h3>
            <p className='text-gray-600 mb-6'>
              {occurrenceActionType === "delete"
                ? "This is a recurring event. What would you like to delete?"
                : "This is a recurring event. What would you like to update?"}
            </p>

            <div className='space-y-2 mb-6'>
              <button
                onClick={() => {
                  setOccurrenceActionMode("single");
                }}
                className={`w-full text-left p-3 border rounded-lg transition-colors ${
                  occurrenceActionMode === "single"
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                }`}
              >
                <p className='font-medium text-gray-900'>This occurrence only</p>
                <p className='text-sm text-gray-600'>
                  {occurrenceActionType === "delete"
                    ? "Delete only this instance"
                    : "Update only this instance"}
                </p>
              </button>

              <button
                onClick={() => {
                  setOccurrenceActionMode("future");
                }}
                className={`w-full text-left p-3 border rounded-lg transition-colors ${
                  occurrenceActionMode === "future"
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                }`}
              >
                <p className='font-medium text-gray-900'>
                  This and all future occurrences
                </p>
                <p className='text-sm text-gray-600'>
                  {occurrenceActionType === "delete"
                    ? "Delete this and all following instances"
                    : "Update this and all following instances"}
                </p>
              </button>

              <button
                onClick={() => {
                  setOccurrenceActionMode("all");
                }}
                className={`w-full text-left p-3 border rounded-lg transition-colors ${
                  occurrenceActionMode === "all"
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                }`}
              >
                <p className='font-medium text-gray-900'>All occurrences</p>
                <p className='text-sm text-gray-600'>
                  {occurrenceActionType === "delete"
                    ? "Delete the entire event series"
                    : "Update all instances in the series"}
                </p>
              </button>
            </div>

            <div className='flex gap-3'>
              <button
                onClick={() => {
                  setShowOccurrenceActionDialog(false);
                  setOccurrenceActionType(null);
                  setOccurrenceActionMode(null);
                }}
                className='flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium'
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsProcessingOccurrence(true);
                  try {
                    if (occurrenceActionType === "delete") {
                      confirmDeleteEvent();
                    } else if (occurrenceActionType === "edit") {
                      const pendingData = (window as any).__pendingEditData;
                      if (pendingData && editingEvent && occurrenceActionMode) {
                        try {
                          let startDateTime: Date;
                          let endDateTime: Date;

                          // For "all" and "future" modes: preserve original dates but allow time changes
                          // The backend will calculate the time offset and apply to all occurrences
                          if (occurrenceActionMode === "single") {
                            // For single: use the new date and time from the form
                            const [startTimeStr, endTimeStr] =
                              pendingData.time.split(" - ");
                            const eventDate = new Date(pendingData.date);

                            startDateTime = new Date(eventDate);
                            const [startHours, startMinutes] = startTimeStr
                              .split(":")
                              .map(Number);
                            startDateTime.setHours(startHours, startMinutes, 0, 0);

                            endDateTime = new Date(eventDate);
                            const [endHours, endMinutes] = endTimeStr
                              .split(":")
                              .map(Number);
                            endDateTime.setHours(endHours, endMinutes, 0, 0);
                          } else {
                            // For "all" and "future": use original event's date but with new time
                            const [startTimeStr, endTimeStr] =
                              pendingData.time.split(" - ");
                            const existingStartDate = new Date(editingEvent.startAt);
                            const existingEndDate = new Date(editingEvent.endAt);

                            // Apply new time to existing dates
                            startDateTime = new Date(existingStartDate);
                            const [startHours, startMinutes] = startTimeStr
                              .split(":")
                              .map(Number);
                            startDateTime.setHours(startHours, startMinutes, 0, 0);

                            endDateTime = new Date(existingEndDate);
                            const [endHours, endMinutes] = endTimeStr
                              .split(":")
                              .map(Number);
                            endDateTime.setHours(endHours, endMinutes, 0, 0);
                          }

                          const updatePayload: any = {
                            title: pendingData.title,
                            description: pendingData.description,
                            type: pendingData.type,
                            frequency:
                              pendingData.frequency ||
                              editingEvent.frequency ||
                              "NONE",
                            daysOfWeek:
                              pendingData.daysOfWeek &&
                              pendingData.daysOfWeek.length > 0
                                ? pendingData.daysOfWeek
                                : editingEvent.daysOfWeek &&
                                    editingEvent.daysOfWeek.length > 0
                                  ? editingEvent.daysOfWeek
                                  : [],
                            timezone: "Africa/Kigali",
                            reminderMinutesBefore: Array.isArray(
                              pendingData.reminders,
                            )
                              ? pendingData.reminders
                              : [Number(pendingData.reminders || 30)],
                            startAt: startDateTime.toISOString(),
                            endAt: endDateTime.toISOString(),
                            meetingType: pendingData.meetingType
                              ?.toUpperCase()
                              .replace("-", "_"),
                            location: pendingData.location,
                            priority: pendingData.priority?.toUpperCase(),
                            hostEmail: pendingData.hostEmail,
                            participants:
                              pendingData.attendees?.map((userId: any) => ({
                                userId,
                              })) || [],
                            externalParticipants: (
                              pendingData.externalParticipants || []
                            ).map((email: string) => ({ email })),
                            attachments: (pendingData.attachments || [])
                              .filter((a: any) => a?.url)
                              .map((a: any) => ({ name: a.name, url: a.url })),
                          };

                          // For "all" and "future" modes, allow user to change recurrence end date
                          if (
                            occurrenceActionMode === "all" ||
                            occurrenceActionMode === "future"
                          ) {
                            updatePayload.recurrenceEndsAt =
                              pendingData.recurrenceEndsAt ||
                              editingEvent.recurrenceEndsAt;
                          }

                          // Call the single updateOccurrence function with the selected mode
                          await updateOccurrence(
                            editingEvent.id,
                            updatePayload,
                            occurrenceActionMode as "single" | "all" | "future",
                          );

                          // Show appropriate success message based on mode
                          const modeMessages = {
                            single: "Occurrence updated successfully!",
                            future:
                              "This and all future occurrences updated successfully!",
                            all: "All occurrences updated successfully!",
                          };
                          toast.success(
                            modeMessages[
                              occurrenceActionMode as "single" | "all" | "future"
                            ],
                          );

                          // Refresh data
                          queryClient.invalidateQueries({ queryKey: ["events"] });
                          setShowEventModal(false);
                          setEditingEvent(null);
                        } catch (error: any) {
                          toast.error(
                            error?.response?.data?.message ||
                              "Failed to update occurrence",
                          );
                        }
                      }
                    }
                  } finally {
                    setShowOccurrenceActionDialog(isProcessingOccurrence);
                    setOccurrenceActionType(null);
                    setOccurrenceActionMode(null);
                    setIsProcessingOccurrence(false);
                  }
                }}
                disabled={!occurrenceActionMode || isProcessingOccurrence}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                  occurrenceActionType === "delete"
                    ? "bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                    : "bg-primary hover:bg-blue-900 disabled:bg-blue-300"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isProcessingOccurrence
                  ? occurrenceActionType === "delete"
                    ? "⏳ Deleting..."
                    : "⏳ Updating..."
                  : occurrenceActionType === "delete"
                    ? "Delete"
                    : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
