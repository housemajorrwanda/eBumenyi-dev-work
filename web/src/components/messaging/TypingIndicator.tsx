import React from "react";

interface TypingIndicatorProps {
  users: Array<{ userId: string; userName: string }>;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ users }) => {
  if (users.length === 0) return null;

  const label =
    users.length === 1
      ? `${users[0].userName || "Someone"} is typing...`
      : `${users.length} people are typing...`;

  return (
    <div className="px-4 pb-1 flex items-center gap-2 text-xs text-gray-500 italic">
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
      </span>
      {label}
    </div>
  );
};
