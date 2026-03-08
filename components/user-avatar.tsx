import { avatarColors, type AvatarColor } from "@/lib/constants";

type UserAvatarProps = {
  firstName: string;
  lastName: string;
  avatarColor: AvatarColor;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

export default function UserAvatar({
  firstName,
  lastName,
  avatarColor,
  size = "sm",
  className = "",
}: UserAvatarProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-full font-medium ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: avatarColors[avatarColor].bg,
        color: avatarColors[avatarColor].text,
      }}
    >
      {firstName[0].toUpperCase()}
      {lastName[0].toUpperCase()}
    </div>
  );
}
