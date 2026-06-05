"use client";

import { type ElementType, useState } from 'react';
import { useAuth } from "@/context/AuthContext";
import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { useRouter } from "next/navigation";
import { Copy, Check, Video, Link2, User } from 'lucide-react';

import { useGetCallById } from "@/hooks/useGetCallById";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Table = ({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon?: ElementType;
}) => {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dark-3 bg-dark-2 p-4 transition-colors hover:border-dark-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-dark-3">
            <Icon size={18} className="text-white/60" />
          </div>
        )}
        <h2 className="text-sm font-medium text-white/60 sm:min-w-[100px]">
          {title}
        </h2>
      </div>
      <p className="flex-1 truncate text-base font-semibold text-white">
        {description}
      </p>
    </div>
  );
};

const PersonalRoom = () => {
  const router = useRouter();
  const { user } = useAuth();
  const client = useStreamVideoClient();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const meetingId = user?.id;
  const { call } = useGetCallById(meetingId!);

  const startRoom = async () => {
    if (!client || !user) return;

    try {
      setIsStarting(true);
      const newCall = client.call("default", meetingId!);

      if (!call) {
        await newCall.getOrCreate({
          data: {
            starts_at: new Date().toISOString(),
          },
        });
      }

      router.push(`/meeting/${meetingId}?personal=true`);
    } catch (error) {
      console.error('Failed to start meeting:', error);
      toast({
        title: 'Failed to start meeting',
        variant: 'destructive',
      });
      setIsStarting(false);
    }
  };

  const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${meetingId}?personal=true`;

  const copyLink = () => {
    navigator.clipboard.writeText(meetingLink);
    setCopied(true);
    toast({
      title: "Link copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="flex size-full flex-col gap-6 text-white sm:gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-1/20">
            <Video size={20} className="text-purple-1" />
          </div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Personal Room</h1>
        </div>
      </div>

      {/* Room Info Cards */}
      <div className="flex w-full flex-col gap-3 xl:max-w-[800px]">
        <Table
          title="Topic"
          description={`${user?.name}'s Meeting Room`}
          icon={User}
        />
        <Table
          title="Meeting ID"
          description={meetingId!}
          icon={Video}
        />
        <Table
          title="Invite Link"
          description={meetingLink}
          icon={Link2}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          onClick={startRoom}
          disabled={isStarting}
          className="gap-2 rounded-full bg-blue-1 px-6 hover:bg-blue-3"
        >
          {isStarting ? (
            <>
              <svg
                className="size-[18px] animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Starting...
            </>
          ) : (
            <>
              <Video size={18} />
              Start Meeting
            </>
          )}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={copyLink}
          className="gap-2 rounded-full px-6"
        >
          {copied ? (
            <>
              <Check size={18} className="text-green-400" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={18} />
              <span>Copy Invitation</span>
            </>
          )}
        </Button>
      </div>
    </section>
  );
};

export default PersonalRoom;
