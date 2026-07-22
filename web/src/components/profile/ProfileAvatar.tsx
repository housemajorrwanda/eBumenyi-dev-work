import { FC } from "react";
import { UserIcon } from "@heroicons/react/24/outline";
import { ProfileAvatarProps } from "@/types/users";

const ProfileAvatar: FC<ProfileAvatarProps> = ({
  name = "User",
  size = "w-4 h-4",
  rounded = true,
  photo,
  color,
  className = "",
}) => {
  // If photo is provided, show the image
  if (photo) {
    return (
      <img
        src={photo}
        alt={`${name}'s profile`}
        className={`${size} ${
          rounded ? "rounded-full" : "rounded"
        } object-cover ${className}`}
        onError={(e) => {
          // Fallback to default avatar if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          target.nextElementSibling?.classList.remove("hidden");
        }}
      />
    );
  }

  // Fallback to initials or icon
  const initials = name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`${size} ${
        rounded ? "rounded-full" : "rounded"
      } ${color || "bg-gray-300 text-gray-700"} flex items-center justify-center font-medium text-sm ${className}`}
    >
      {initials || <UserIcon className='w-4 h-4' />}
    </div>
  );
};

export default ProfileAvatar;
