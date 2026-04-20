// Re-export everything from the existing types file so we have ONE source of truth
export type {
  ResumeData,
  PersonalInfo,
  ExperienceItem,
  EducationItem,
  CertificationItem,
} from "@/types/resume";

import type { ComponentType } from "react";
import type { ResumeData } from "@/types/resume";

export type TemplateId = "classic" | "modern" | "minimal";

export interface TemplateComponentProps {
  data: ResumeData;
  sectionsOrder?: string[];
}

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
  isPro: boolean;
  thumbnail: string;
  Component: ComponentType<TemplateComponentProps>;
}
