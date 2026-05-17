import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface TestimonialCardProps {
  quote: string;
  name: string;
  role: string;
  initials: string;
  avatarBgClassName: string;
}

export function TestimonialCard({
  quote,
  name,
  role,
  initials,
  avatarBgClassName,
}: TestimonialCardProps) {
  return (
    <Card className="rounded-[12px] p-6 bg-[var(--color-card)] border-[var(--color-border)] shadow-none">
      <CardContent className="p-0 flex flex-col gap-[18px]">
        <div
          aria-hidden="true"
          className="font-display text-[48px] font-bold leading-none text-[var(--color-primary)] h-[18px]"
        >
          &ldquo;
        </div>
        <p className="m-0 font-body text-[15px] leading-relaxed text-[var(--color-foreground)] flex-1">
          {quote}
        </p>
        <Separator className="my-0" />
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback
              className={cn(
                "font-display font-bold text-[13px] tracking-[-0.02em] text-[#2a251f]",
                avatarBgClassName,
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="font-display text-[14px] font-semibold text-[var(--color-foreground)]">
              {name}
            </div>
            <div className="font-body text-[12.5px] text-[var(--color-muted-fg)]">
              {role}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
