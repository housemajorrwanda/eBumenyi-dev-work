'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
} from './ui/dialog';
import HostSettings from './HostSettings';

interface HostSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HostSettingsModal: React.FC<HostSettingsModalProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl border-dark-3 bg-dark-1 text-white shadow-2xl overflow-hidden flex flex-col max-h-[95vh] p-0">
        {/* The HostSettings component handles its own layout including header and footer */}
        <HostSettings onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};

export default HostSettingsModal;
