import { ClassicTemplate } from "./classic";
import { ModernTemplate } from "./modern";
import { MinimalTemplate } from "./minimal";
import type { TemplateId, TemplateMeta } from "./types";

// SVG thumbnails — imported as static asset URLs via Next.js
const classicThumbnail = "/resume-templates/classic-thumbnail.svg";
const modernThumbnail = "/resume-templates/modern-thumbnail.svg";
const minimalThumbnail = "/resume-templates/minimal-thumbnail.svg";

export const TEMPLATES: Record<TemplateId, TemplateMeta> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "Clean single-column layout with section headings and clear hierarchy.",
    isPro: false,
    thumbnail: classicThumbnail,
    Component: ClassicTemplate,
  },
  modern: {
    id: "modern",
    name: "Modern",
    description: "Two-column layout with indigo accents for a contemporary look.",
    isPro: true,
    thumbnail: modernThumbnail,
    Component: ModernTemplate,
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Single-column, whitespace-heavy design focused on typography.",
    isPro: true,
    thumbnail: minimalThumbnail,
    Component: MinimalTemplate,
  },
};

export function getTemplate(id: string): TemplateMeta {
  return TEMPLATES[id as TemplateId] ?? TEMPLATES.classic;
}

export function getAvailableTemplates(): TemplateMeta[] {
  return [TEMPLATES.classic, TEMPLATES.modern, TEMPLATES.minimal];
}
