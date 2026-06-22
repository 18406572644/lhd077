import { X } from "lucide-react";
import type { Tag } from "../../shared/types";

interface TagBadgeProps {
  tag: Tag;
  onRemove?: () => void;
  size?: "sm" | "md";
  className?: string;
}

export default function TagBadge({
  tag,
  onRemove,
  size = "md",
  className = "",
}: TagBadgeProps) {
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: `${tag.color}15`,
        color: tag.color,
        border: `1px solid ${tag.color}30`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: tag.color }}
      />
      <span className="truncate max-w-[120px]">{tag.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
