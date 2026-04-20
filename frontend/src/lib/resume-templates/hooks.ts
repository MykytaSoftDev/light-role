import { usePlan } from "@/hooks/use-plan";
import { TEMPLATES } from "./registry";
import type { TemplateId } from "./types";

export function useUserPlan(): "free" | "pro" {
  const { isProPlan } = usePlan();
  return isProPlan ? "pro" : "free";
}

export function useCanUseTemplate(templateId: TemplateId): boolean {
  const plan = useUserPlan();
  return !TEMPLATES[templateId].isPro || plan === "pro";
}
