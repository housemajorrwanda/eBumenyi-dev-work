"use client";

import Image from "next/image";
import { Calendar, Clock, Copy, Play, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { useToast } from "./ui/use-toast";

interface Participant {
  id: string;
  image?: string;
  name?: string;
}

interface MeetingCardProps {
  title: string;
  date: string;
  icon: string;
  isPreviousMeeting?: boolean;
  buttonIcon1?: string;
  buttonText?: string;
  handleClick: () => void;
  link: string;
  participants?: Participant[];
}

const MeetingCard = ({
  icon,
  title,
  date,
  isPreviousMeeting,
  buttonIcon1,
  handleClick,
  link,
  buttonText,
  participants = [],
}: MeetingCardProps) => {
  const { toast } = useToast();

  return (
    <section className="group flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-dark-3 bg-dark-2 transition-all duration-300 hover:border-blue-2/30 hover:shadow-meet xl:max-w-[568px]">
      {/* Header with icon and info */}
      <article className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          {/* Icon container */}
          <div className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
            isPreviousMeeting ? "bg-dark-4" : "bg-blue-1/20"
          )}>
            <Image
              src={icon}
              alt="meeting type"
              width={24}
              height={24}
              className={isPreviousMeeting ? "opacity-60" : ""}
            />
          </div>

          {/* Title and date */}
          <div className="flex flex-1 flex-col gap-1.5">
            <h2 className="line-clamp-2 text-lg font-semibold text-white sm:text-xl">
              {title}
            </h2>
            <div className="flex items-center gap-2 text-white/60">
              <Clock size={14} />
              <p className="text-sm">{date}</p>
            </div>
          </div>
        </div>
      </article>

      {/* Participants preview */}
      <article className="flex flex-col gap-3 border-t border-dark-3 px-5 py-4 sm:px-6">
        {/* Avatar stack with names */}
        <div className="flex items-center gap-3">
          {participants.length > 0 ? (
            <>
              <div className="flex -space-x-2">
                {participants.slice(0, 4).map((participant, index) => (
                  <Image
                    key={participant.id || index}
                    src={participant.image || '/icons/avatar.svg'}
                    alt={participant.name || 'Participant'}
                    width={32}
                    height={32}
                    className="rounded-full border-2 border-dark-2 bg-dark-3 object-cover transition-transform hover:z-10 hover:scale-110"
                    title={participant.name || 'Unknown'}
                  />
                ))}
              </div>
              {participants.length > 4 && (
                <div className="flex size-8 items-center justify-center rounded-full border-2 border-dark-2 bg-dark-4 text-xs font-medium text-white">
                  +{participants.length - 4}
                </div>
              )}
              {/* Participant count */}
              <span className="text-sm text-white/60">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <div className="flex size-8 items-center justify-center rounded-full bg-dark-4">
                <Users size={14} />
              </div>
              <span>No participants</span>
            </div>
          )}
        </div>

        {/* Show participant names for previous meetings */}
        {isPreviousMeeting && participants.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {participants.slice(0, 6).map((participant, index) => (
              <span
                key={participant.id || index}
                className="inline-flex items-center gap-1.5 rounded-full bg-dark-3/50 px-2.5 py-1 text-xs text-white/70"
              >
                {participant.image ? (
                  <Image
                    src={participant.image}
                    alt={participant.name || 'Participant'}
                    width={16}
                    height={16}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex size-4 items-center justify-center rounded-full bg-dark-4 text-[10px]">
                    {(participant.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                {participant.name || 'Unknown'}
              </span>
            ))}
            {participants.length > 6 && (
              <span className="inline-flex items-center rounded-full bg-dark-3/50 px-2.5 py-1 text-xs text-white/50">
                +{participants.length - 6} more
              </span>
            )}
          </div>
        )}
      </article>

      {/* Action buttons section */}
      <article className="flex items-center justify-between border-t border-dark-3 px-5 py-3 sm:px-6">

        {/* Action buttons */}
        {!isPreviousMeeting && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast({
                  title: "Link copied to clipboard",
                });
              }}
              variant="ghost"
              className="h-10 gap-2 rounded-full bg-dark-3 px-4 text-white/70 transition-colors hover:bg-dark-4 hover:text-white"
            >
              <Copy size={16} />
              <span className="hidden sm:inline">Copy</span>
            </Button>
            <Button
              onClick={handleClick}
              className="h-10 gap-2 rounded-full bg-blue-1 px-5 font-medium text-white transition-all hover:bg-blue-3 hover:shadow-lg"
            >
              {buttonText === 'Play' ? (
                <Play size={16} />
              ) : (
                buttonIcon1 && <Image src={buttonIcon1} alt="action" width={16} height={16} />
              )}
              {buttonText}
            </Button>
          </div>
        )}

        {isPreviousMeeting && (
          <div className="flex items-center gap-2 rounded-full bg-dark-4 px-3 py-1.5 text-sm text-white/50">
            <Calendar size={14} />
            <span>Ended</span>
          </div>
        )}
      </article>
    </section>
  );
};

export default MeetingCard;
