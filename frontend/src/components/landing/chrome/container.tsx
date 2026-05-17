import { cn } from "@/lib/utils";

type ContainerProps<T extends React.ElementType> = {
  as?: T;
  narrow?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "narrow" | "className" | "children">;

export function Container<T extends React.ElementType = "div">({
  as,
  narrow = false,
  className,
  children,
  ...rest
}: ContainerProps<T>) {
  const Tag = (as ?? "div") as React.ElementType;
  return (
    <Tag
      className={cn(
        "mx-auto w-full px-6 md:px-14",
        narrow ? "max-w-[880px]" : "max-w-[1200px]",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
