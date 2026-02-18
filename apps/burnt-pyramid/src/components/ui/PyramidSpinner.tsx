"use client";

interface PyramidSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PyramidSpinner({ size = "md", className = "" }: PyramidSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16"
  };

  return (
    <div className={`pyramid-spinner ${sizeClasses[size]} ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <polygon
          points="50,10 90,80 10,80"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pyramid-path"
        />
      </svg>
    </div>
  );
}
