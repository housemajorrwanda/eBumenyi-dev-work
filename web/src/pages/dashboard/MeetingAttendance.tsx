import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  UsersIcon,
  ClockIcon,
  ChartPieIcon,
} from '@heroicons/react/24/outline';
import api from '@/services/api';
import ExcelJS from 'exceljs';

interface UserRoleEntry {
  name: string;
}

interface AttendanceRecord {
  id: string;
  userId: string | null;
  guestName: string | null;
  joinedAt: string;
  leftAt: string | null;
  durationSec: number | null;
  user?: {
    id: string;
    fullNames: string;
    email: string;
    photo: string | null;
    gender: string | null;
    district: string | null;
    sector: string | null;
    cell: string | null;
    village: string | null;
    hospital: { name: string } | null;
    userRoles: UserRoleEntry[];
  };
  event?: {
    id: string;
    title: string;
    startAt: string;
    createdById: string;
  };
}

interface InvitedUserProfile {
  id: string;
  fullNames: string;
  email: string;
  gender: string | null;
  district: string | null;
  sector: string | null;
  cell: string | null;
  village: string | null;
  hospital: { name: string } | null;
  userRoles: UserRoleEntry[];
}

interface InvitedInfo {
  total: number;
  attended: number;
  pct: number | null;
  absentees: InvitedUserProfile[];
}

interface AggregatedAttendee {
  key: string;
  userId: string | null;
  name: string;
  email: string | null;
  photo: string | null;
  role: string;
  hospital: string;
  gender: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  totalDurationSec: number;
  isGuest: boolean;
  isHost: boolean;
}

const ROLE_DISPLAY: Record<string, string> = {
  TRAINEE: 'CHW',
};

const displayRole = (role: string) => ROLE_DISPLAY[role.toUpperCase()] ?? role;

const formatDuration = (sec: number): string => {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

const PAGE_SIZE = 15;

const MeetingAttendance: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', eventId],
    queryFn: async () => {
      const res = await api.get(`/attendance/event/${eventId}`);
      return {
        records: (res.data?.data ?? []) as AttendanceRecord[],
        invited: (res.data?.invited ?? null) as InvitedInfo | null,
      };
    },
    enabled: !!eventId,
    staleTime: Infinity,        // attendance report is static — don't re-fetch automatically
    refetchOnWindowFocus: false,
  });

  const records = data?.records ?? [];
  const invited = data?.invited ?? null;
  const eventTitle = records[0]?.event?.title;

  // Group by user — sum duration across all sessions in the same meeting.
  const attendees = useMemo<AggregatedAttendee[]>(() => {
    const hostId = records[0]?.event?.createdById ?? null;

    // Find the latest recorded leave time across ALL participants.
    // Registered users who left properly have leftAt set — we use the maximum
    // as a proxy for when the meeting ended, so we can cap guests whose
    // leftAt was never recorded (closed tab / disconnected without calling leave).
    const meetingEndMs = records.reduce((max, r) => {
      if (!r.leftAt) return max;
      const t = new Date(r.leftAt).getTime();
      return t > max ? t : max;
    }, 0);

    const map = new Map<string, AggregatedAttendee>();
    for (const r of records) {
      const key = r.userId ?? `guest:${r.guestName ?? 'unknown'}`;
      const joinedMs = new Date(r.joinedAt).getTime();

      let estimatedDuration: number;
      if (r.leftAt) {
        // Session closed — compute from timestamps (durationSec can be 0 on fast leave)
        const fromTs = Math.round((new Date(r.leftAt).getTime() - joinedMs) / 1000);
        estimatedDuration = (r.durationSec && r.durationSec > 0) ? r.durationSec : fromTs;
      } else if (meetingEndMs > joinedMs) {
        // leftAt never recorded, but we know the meeting ended (other participants left later)
        // Cap here so the duration is frozen at meeting-end instead of growing with time
        estimatedDuration = Math.round((meetingEndMs - joinedMs) / 1000);
      } else {
        // meetingEndMs proxy didn't help (joined after all known exits, or no exits recorded).
        // Use the backend-provided durationSec as a last resort — it's safe because
        // staleTime: Infinity means the query never re-fetches, so this value is frozen.
        estimatedDuration = (r.durationSec && r.durationSec > 0) ? r.durationSec : 0;
      }

      if (!map.has(key)) {
        map.set(key, {
          key,
          userId: r.userId,
          name: r.user?.fullNames ?? r.guestName ?? 'Unknown',
          email: r.user?.email ?? null,
          photo: r.user?.photo ?? null,
          role: r.user?.userRoles?.[0]?.name ?? '—',
          hospital: r.user?.hospital?.name ?? '—',
          gender: r.user?.gender ?? '—',
          district: r.user?.district ?? '—',
          sector: r.user?.sector ?? '—',
          cell: r.user?.cell ?? '—',
          village: r.user?.village ?? '—',
          totalDurationSec: estimatedDuration,
          isGuest: !r.userId,
          isHost: !!r.userId && r.userId === hostId,
        });
      } else {
        map.get(key)!.totalDurationSec += estimatedDuration;
      }
    }
    // Host always first, then registered users, then guests
    return [...map.values()].sort((a, b) => {
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      if (a.isGuest !== b.isGuest) return a.isGuest ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [records]);

  const registered = attendees.filter((a) => !a.isGuest);
  const guests = attendees.filter((a) => a.isGuest);
  const avgDurationSec =
    attendees.length > 0
      ? Math.round(attendees.reduce((s, a) => s + a.totalDurationSec, 0) / attendees.length)
      : 0;

  const filtered = attendees.filter((a) => {
    const term = searchTerm.toLowerCase();
    return (
      a.name.toLowerCase().includes(term) ||
      (a.email ?? '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Attended');

    const PRIMARY   = '3363AD';
    const ABSENT_RED = 'B91C1C';
    const ABSENT_BG  = 'FEF2F2'; // red-50
    const HOST_BG   = 'FEF3C7'; // amber-100
    const REG_BG    = 'EFF6FF'; // blue-50
    const GUEST_BG  = 'FFF7ED'; // orange-50
    const WHITE     = 'FFFFFF';
    const DARK      = '1E293B';

    const colDefs = [
      { header: 'Name',     key: 'name',     width: 28 },
      { header: 'Email',    key: 'email',    width: 28 },
      { header: 'Role',     key: 'role',     width: 14 },
      { header: 'Hospital', key: 'hospital', width: 22 },
      { header: 'Gender',   key: 'gender',   width: 10 },
      { header: 'District', key: 'district', width: 16 },
      { header: 'Sector',   key: 'sector',   width: 16 },
      { header: 'Cell',     key: 'cell',     width: 16 },
      { header: 'Village',  key: 'village',  width: 16 },
      { header: 'Type',     key: 'type',     width: 12 },
      { header: 'Duration', key: 'duration', width: 14 },
    ];

    // ── Title row ──────────────────────────────────────────────
    ws.mergeCells(1, 1, 1, colDefs.length);
    const titleCell = ws.getCell('A1');
    titleCell.value = `Meeting Attendance${eventTitle ? ' — ' + eventTitle : ''}`;
    titleCell.font = { bold: true, size: 14, color: { argb: WHITE } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    // ── Summary row ────────────────────────────────────────────
    ws.mergeCells(2, 1, 2, colDefs.length);
    const summaryCell = ws.getCell('A2');
    summaryCell.value =
      `Total: ${attendees.length}   |   Registered: ${registered.length}   |   Guests: ${guests.length}   |   Avg Duration: ${formatDuration(avgDurationSec)}`;
    summaryCell.font = { italic: true, size: 10, color: { argb: '64748B' } };
    summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    ws.getRow(2).height = 20;

    // ── Blank spacer ───────────────────────────────────────────
    ws.addRow([]);

    // ── Column headers ─────────────────────────────────────────
    ws.columns = colDefs.map((c) => ({ key: c.key, width: c.width }));
    const headerRow = ws.addRow(colDefs.map((c) => c.header));
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: WHITE } },
      };
    });

    // ── Data rows ──────────────────────────────────────────────
    attendees.forEach((a, i) => {
      const row = ws.addRow({
        name:     a.isHost ? `${a.name} (Host)` : a.name,
        email:    a.email ?? '—',
        role:     a.isGuest ? 'Guest' : displayRole(a.role),
        hospital: a.hospital,
        gender:   a.gender,
        district: a.district,
        sector:   a.sector,
        cell:     a.cell,
        village:  a.village,
        type:     a.isGuest ? 'Guest' : 'Registered',
        duration: formatDuration(a.totalDurationSec),
      });

      const bg = a.isHost ? HOST_BG : a.isGuest ? GUEST_BG : i % 2 === 0 ? WHITE : REG_BG;
      row.height = 18;
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font = { color: { argb: DARK }, bold: a.isHost };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        };
      });

      // Left accent bar for host
      if (a.isHost) {
        row.getCell(1).border = {
          left:   { style: 'medium', color: { argb: PRIMARY } },
          bottom: { style: 'thin',   color: { argb: 'E2E8F0' } },
        };
      }
    });

    // ── Freeze panes ───────────────────────────────────────────
    ws.views = [{ state: 'frozen', ySplit: 4 }];

    // ── Absent sheet ───────────────────────────────────────────
    // Only internally-invited (registered) participants who never joined.
    // Guests and externally-invited people are never evaluated for absence
    // since there's no reliable way to match them to an invite record.
    const absentees = invited?.absentees ?? [];
    const wsAbsent = wb.addWorksheet('Absent');

    const absentColDefs = [
      { header: 'Name',     key: 'name',     width: 28 },
      { header: 'Email',    key: 'email',    width: 28 },
      { header: 'Role',     key: 'role',     width: 14 },
      { header: 'Hospital', key: 'hospital', width: 22 },
      { header: 'Gender',   key: 'gender',   width: 10 },
      { header: 'District', key: 'district', width: 16 },
      { header: 'Sector',   key: 'sector',   width: 16 },
      { header: 'Cell',     key: 'cell',     width: 16 },
      { header: 'Village',  key: 'village',  width: 16 },
    ];

    wsAbsent.mergeCells(1, 1, 1, absentColDefs.length);
    const absentTitleCell = wsAbsent.getCell('A1');
    absentTitleCell.value = `Absent — Invited but did not attend${eventTitle ? ' — ' + eventTitle : ''}`;
    absentTitleCell.font = { bold: true, size: 14, color: { argb: WHITE } };
    absentTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ABSENT_RED } };
    absentTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsAbsent.getRow(1).height = 30;

    wsAbsent.mergeCells(2, 1, 2, absentColDefs.length);
    const absentSummaryCell = wsAbsent.getCell('A2');
    absentSummaryCell.value =
      `Invited: ${invited?.total ?? 0}   |   Attended: ${invited?.attended ?? 0}   |   Absent: ${absentees.length}`;
    absentSummaryCell.font = { italic: true, size: 10, color: { argb: '64748B' } };
    absentSummaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
    absentSummaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    wsAbsent.getRow(2).height = 20;

    wsAbsent.addRow([]);

    wsAbsent.columns = absentColDefs.map((c) => ({ key: c.key, width: c.width }));
    const absentHeaderRow = wsAbsent.addRow(absentColDefs.map((c) => c.header));
    absentHeaderRow.height = 22;
    absentHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ABSENT_RED } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: WHITE } },
      };
    });

    absentees.forEach((p, i) => {
      const row = wsAbsent.addRow({
        name:     p.fullNames,
        email:    p.email ?? '—',
        role:     displayRole(p.userRoles?.[0]?.name ?? '—'),
        hospital: p.hospital?.name ?? '—',
        gender:   p.gender ?? '—',
        district: p.district ?? '—',
        sector:   p.sector ?? '—',
        cell:     p.cell ?? '—',
        village:  p.village ?? '—',
      });
      row.height = 18;
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? WHITE : ABSENT_BG } };
        cell.font = { color: { argb: DARK } };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        };
      });
    });

    wsAbsent.views = [{ state: 'frozen', ySplit: 4 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${eventTitle ?? eventId}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Meeting Attendance</h1>
          {eventTitle && <p className="text-sm text-gray-500 mt-0.5">{eventTitle}</p>}
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-[#4d81d2] transition-colors flex-shrink-0"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* Stat Cards */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <UserGroupIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{attendees.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <UsersIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{registered.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Registered</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <UsersIcon className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{guests.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Guests</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <ClockIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatDuration(avgDurationSec)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Avg Duration</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
              <ChartPieIcon className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {invited && invited.pct !== null ? `${invited.pct}%` : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Attendance Rate
                {guests.length > 0 && ` · +${guests.length} guest${guests.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <UserGroupIcon className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">No attendance records</p>
            <p className="text-sm">Records appear after participants join the meeting</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden sm:table w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hospital</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Gender</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">District</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sector</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cell</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Village</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((attendee) => (
                  <tr key={attendee.key} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {attendee.photo ? (
                          <img src={attendee.photo} alt={attendee.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-gray-600">
                              {attendee.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-900">{attendee.name}</p>
                            {attendee.isHost && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary text-white">
                                Host
                              </span>
                            )}
                          </div>
                          {attendee.email && <p className="text-xs text-gray-400">{attendee.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        attendee.isGuest
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {attendee.isGuest ? 'Guest' : displayRole(attendee.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{attendee.hospital}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                      {attendee.gender}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{attendee.district}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{attendee.sector}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{attendee.cell}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{attendee.village}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">
                      {formatDuration(attendee.totalDurationSec)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-gray-100">
              {paginated.map((attendee) => (
                <div key={attendee.key} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-gray-600">
                          {attendee.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{attendee.name}</p>
                        {attendee.email && <p className="text-xs text-gray-400">{attendee.email}</p>}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      attendee.isGuest ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {attendee.isGuest ? 'Guest' : displayRole(attendee.role)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 pl-10">
                    <span>{attendee.hospital}</span>
                    <span>·</span>
                    <span className="capitalize">{attendee.gender}</span>
                    <span>·</span>
                    <span>{attendee.district}</span>
                    <span>·</span>
                    <span>{attendee.sector}</span>
                    <span>·</span>
                    <span>{attendee.cell}</span>
                    <span>·</span>
                    <span>{attendee.village}</span>
                    <span>·</span>
                    <span className="font-medium text-gray-700">{formatDuration(attendee.totalDurationSec)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-4 text-sm">
          <p className="text-gray-500">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-9 h-9 rounded-lg border text-sm font-medium transition-colors ${
                      safePage === p
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingAttendance;
