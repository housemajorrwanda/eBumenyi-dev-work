import { useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void | Promise<void>;
}

export const useConfirmDialog = () => {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const confirm = (options: ConfirmOptions) => setState(options);

  const handleConfirm = async () => {
    if (!state) return;
    setIsConfirming(true);
    try {
      await state.onConfirm();
    } finally {
      setIsConfirming(false);
      setState(null);
    }
  };

  const dialog = state && (
    <ConfirmDialog
      isOpen
      onClose={() => !isConfirming && setState(null)}
      onConfirm={handleConfirm}
      isLoading={isConfirming}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
    />
  );

  return { confirm, dialog };
};
