'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
} from './ui/dialog';
import CallSettings from './CallSettings';

interface CallSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CallSettingsModal: React.FC<CallSettingsModalProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl border-dark-3 bg-dark-1 text-white shadow-2xl overflow-hidden flex flex-col max-h-[95vh] p-0">
        {/* The CallSettings component handles its own layout including header and footer */}
        <CallSettings onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};

export default CallSettingsModal;
