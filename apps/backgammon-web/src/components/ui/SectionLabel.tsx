interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div
      className={className}
      style={{
        fontSize: "0.6875rem",
        fontWeight: 700,
        color: "var(--color-text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}
