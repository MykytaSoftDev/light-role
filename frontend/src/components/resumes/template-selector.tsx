"use client";

import { useState } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getAvailableTemplates,
  getTemplate,
} from "@/lib/resume-templates/registry";
import { useCanUseTemplate } from "@/lib/resume-templates/hooks";
import type { TemplateId } from "@/lib/resume-templates/types";
import { UpgradeTemplateModal } from "./upgrade-template-modal";

interface TemplateSelectorProps {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  disabled?: boolean;
}

export function TemplateSelector({ value, onChange, disabled }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const templates = getAvailableTemplates();
  const currentTemplate = getTemplate(value);

  // Hooks must be called unconditionally at the top level — one per template ID
  const canUseClassic = useCanUseTemplate("classic");
  const canUseModern = useCanUseTemplate("modern");
  const canUseMinimal = useCanUseTemplate("minimal");
  const canUseMap: Record<TemplateId, boolean> = {
    classic: canUseClassic,
    modern: canUseModern,
    minimal: canUseMinimal,
  };

  function handleSelect(id: TemplateId) {
    if (!canUseMap[id]) {
      setOpen(false);
      setUpgradeOpen(true);
      return;
    }
    onChange(id);
    setOpen(false);
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs px-3 shrink-0"
            disabled={disabled}
          >
            {currentTemplate.name}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="p-2 w-56">
          {templates.map((tpl) => {
            const canUse = canUseMap[tpl.id];
            const isSelected = value === tpl.id;

            return (
              <div
                key={tpl.id}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                className={cn(
                  "flex items-start gap-3 rounded-md p-2 cursor-pointer select-none",
                  "hover:bg-accent transition-colors",
                  isSelected && "bg-accent",
                  !canUse && "opacity-70"
                )}
                onClick={() => handleSelect(tpl.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(tpl.id);
                  }
                }}
              >
                {/* Thumbnail with optional lock overlay */}
                <div className="relative shrink-0 w-[45px] h-[60px] rounded border border-border overflow-hidden bg-white">
                  <img
                    src={tpl.thumbnail}
                    alt={tpl.name}
                    className="w-full h-full object-cover"
                  />
                  {!canUse && (
                    <div className="absolute inset-0 flex items-end justify-end p-1 bg-black/10">
                      <Lock className="h-3.5 w-3.5 text-white drop-shadow" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">
                      {tpl.name}
                    </span>
                    {tpl.isPro && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 h-4"
                      >
                        Pro
                      </Badge>
                    )}
                    {isSelected && (
                      <Check className="h-3 w-3 text-primary ml-auto shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                    {tpl.description}
                  </p>
                </div>
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <UpgradeTemplateModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}
