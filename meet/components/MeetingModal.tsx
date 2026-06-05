"use client";
import { ReactNode } from "react";
import { Dialog, DialogContent } from "./ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import Image from "next/image";

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  className?: string;
  children?: ReactNode;
  handleClick?: () => void;
  buttonText?: string;
  instantMeeting?: boolean;
  image?: string;
  buttonClassName?: string;
  buttonIcon?: string;
  isLoading?: boolean;
}

const MeetingModal = ({
  isOpen,
  onClose,
  title,
  className,
  children,
  handleClick,
  buttonText,
  instantMeeting,
  image,
  buttonClassName,
  buttonIcon,
  isLoading = false,
}: MeetingModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="meeting-modal flex w-full max-w-[95vw] max-h-[90vh] sm:max-w-[480px] sm:max-h-[85vh] flex-col gap-4 sm:gap-6 border border-dark-3 bg-dark-1 p-0 text-white shadow-meet-lg rounded-lg sm:rounded-2xl overflow-y-auto">
        {/* Header */}
        <div className="border-b border-dark-3 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6 sticky top-0 bg-dark-1 z-10">
          <h1 className={cn("text-lg font-semibold text-white xs:text-xl sm:text-2xl line-clamp-2", className)}>
            {title}
          </h1>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 px-4 sm:gap-5 sm:px-6 flex-1">
          {image && (
            <div className="flex justify-center py-2">
              <div className="flex size-14 xs:size-16 items-center justify-center rounded-full bg-blue-1/20 flex-shrink-0">
                <Image src={image} alt="icon" width={32} height={32} />
              </div>
            </div>
          )}
          <div className="overflow-y-auto max-h-[calc(90vh-180px)] sm:max-h-[calc(85vh-180px)]">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-dark-3 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4 sticky bottom-0 bg-dark-1 z-10">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              className="order-2 h-10 xs:h-11 rounded-full px-4 xs:px-6 text-xs xs:text-sm text-white/70 transition-colors hover:bg-dark-3 hover:text-white touch-target sm:order-1"
            >
              Cancel
            </Button>
            <Button
              className={cn(
                "order-1 h-10 xs:h-11 rounded-full bg-blue-1 px-4 xs:px-6 text-xs xs:text-sm font-medium text-white transition-all hover:bg-blue-3 hover:shadow-lg active:scale-95 touch-target sm:order-2",
                buttonClassName
              )}
              onClick={handleClick}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg
                    className="mr-1 xs:mr-2 size-3 xs:size-4 animate-spin text-white flex-shrink-0"
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
                  <span className="hidden xs:inline">Starting...</span>
                  <span className="xs:hidden">Loading...</span>
                </>
              ) : (
                <>
                  {buttonIcon && (
                    <Image
                      src={buttonIcon}
                      alt="button icon"
                      width={16}
                      height={16}
                      className="mr-1 xs:mr-2 flex-shrink-0"
                    />
                  )}
                  {buttonText || "Confirm"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingModal;
