import { cn } from "@/lib/utils";

// A small SVG progress ring. Pass `value` (0..1) for a determinate ring, or
// omit it for an indeterminate spinner. Colors come from `currentColor`, so the
// caller controls the stroke via a text-color class.
export function CircularProgress({
  value,
  size = 28,
  strokeWidth = 3,
  className,
  "aria-label": ariaLabel = "Uploading",
}: {
  value?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const indeterminate = value == null;
  const clamped = Math.min(1, Math.max(0, value ?? 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn(indeterminate && "animate-spin", className)}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped * 100)}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-current opacity-25"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="stroke-current transition-[stroke-dashoffset] duration-200"
        strokeDasharray={circumference}
        // Indeterminate: leave a fixed gap and let the spin animation move it.
        strokeDashoffset={
          indeterminate ? circumference * 0.75 : circumference * (1 - clamped)
        }
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
}
