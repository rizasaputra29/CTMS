import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: "page" | "section" | "inline";
  text?: string;
  className?: string;
}

export function Loading({ 
  variant = "page", 
  text = "Memuat halaman...",
  className 
}: LoadingProps) {
  const baseStyles = "flex flex-col items-center justify-center gap-4";
  
  const variantStyles = {
    page: "min-h-screen",
    section: "min-h-[400px] rounded-lg",
    inline: "py-8",
  };

  return (
    <div className={cn(baseStyles, variantStyles[variant], className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      {variant !== "inline" && (
        <p className="text-muted-foreground text-sm">{text}</p>
      )}
    </div>
  );
}
