import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  ChartPieIcon,
} from '@heroicons/react/24/outline';
import api from '@/services/api';

interface Meeting {
  id: string;
  title: string;
  meetingType: string;
  host: { id: string; fullNames: string; email: string } | null;
  startAt: string;
  endAt: string | null;
  status: 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
  participantCount: number;
  totalDurationSec: number;
}

interface Stats {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  totalParticipants: number;
  avgDurationSec: number;
  overallAttendancePct: number | null;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-RW', { hour: '2-digit', minute: '2-digit', hour12: false });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-RW', { day: '2-digit', month: 'short', year: 'numeric' });

const formatDuration = (sec: number): string => {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const STATUS_STYLE: Record<string, string> = {
  UPCOMING:  'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const PAGE_SIZE = 15;

const MeetingsList: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['meetings-list'],
    queryFn: async () => {
      const res = await api.get('/attendance/meetings');
      return res.data?.data as { meetings: Meeting[]; stats: Stats };
    },
  });

  const meetings = data?.meetings ?? [];
  const stats = data?.stats;

  const filtered = meetings.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    (m.host?.fullNames ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const statCards = stats
    ? [
        { label: 'Total',              value: stats.total,            icon: CalendarDaysIcon, color: 'bg-blue-50 text-primary' },
        { label: 'Upcoming',           value: stats.upcoming,         icon: CalendarDaysIcon, color: 'bg-sky-50 text-sky-600' },
        { label: 'Completed',          value: stats.completed,        icon: CheckCircleIcon,  color: 'bg-green-50 text-green-600' },
        { label: 'Cancelled',          value: stats.cancelled,        icon: XCircleIcon,      color: 'bg-red-50 text-red-500' },
        { label: 'Total Participants', value: stats.totalParticipants, icon: UserGroupIcon,   color: 'bg-purple-50 text-purple-600' },
        { label: 'Avg Duration',       value: formatDuration(stats.avgDurationSec), icon: ClockIcon, color: 'bg-orange-50 text-orange-600' },
        { label: 'Attendance Rate',    value: stats.overallAttendancePct !== null ? `${stats.overallAttendancePct}%` : '—', icon: ChartPieIcon, color: 'bg-teal-50 text-teal-600' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Meetings</h1>
        <p className="text-sm text-gray-500 mt-0.5">All eBumenyi virtual meetings</p>
      </div>

      {/* Stat Cards */}
      {!isLoading && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${color.split(' ')[0]}`}>
                <Icon className={`w-5 h-5 ${color.split(' ')[1]}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by title or host..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
            <CalendarDaysIcon className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">No meetings found</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <table className="hidden sm:table w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  {['Title', 'Host', 'Date', 'Start Time', 'End Time', 'Status', 'Participants'].map((h) => (
                    <th key={h} className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{m.title}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">{m.host?.fullNames ?? '—'}</p>
                      {m.host?.email && <p className="text-xs text-gray-400">{m.host.email}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{formatDate(m.startAt)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatTime(m.startAt)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{m.endAt ? formatTime(m.endAt) : '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[m.status]}`}>
                        {m.status.charAt(0) + m.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/attendance/${m.id}`)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          m.participantCount > 0
                            ? 'bg-primary text-white hover:bg-[#4d81d2]'
                            : 'bg-gray-100 text-gray-500 cursor-default'
                        }`}
                        disabled={m.participantCount === 0}
                      >
                        <UserGroupIcon className="w-3.5 h-3.5" />
                        {m.participantCount}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {paginated.map((m) => (
                <div key={m.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                      <p className="text-xs text-gray-500">{m.host?.fullNames ?? '—'}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_STYLE[m.status]}`}>
                      {m.status.charAt(0) + m.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDate(m.startAt)} · {formatTime(m.startAt)}{m.endAt ? ` – ${formatTime(m.endAt)}` : ''}</span>
                    <button
                      onClick={() => navigate(`/attendance/${m.id}`)}
                      className="flex items-center gap-1 text-primary font-medium"
                    >
                      <UserGroupIcon className="w-3.5 h-3.5" />
                      {m.participantCount} participants
                    </button>
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

export default MeetingsList;
