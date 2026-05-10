"use client";

/**
 * TAILOR-10 — Personal Info (header) editor.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.1.
 *
 * Plain text inputs only — NO Tiptap. The header is rendered ABOVE all other
 * sections per ClassicTemplate's contract; it is NOT part of `sections_order`.
 *
 * Validation: `email` is the only field with real-time pattern validation.
 * If the email is non-empty AND invalid, the parent EditableTemplate reports
 * an error via the `onValidityChange` callback so the toolbar can disable
 * Save (per task spec Step 10).
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PersonalInfo, SocialLink } from "@/lib/profile-api";

import { InlineTextField } from "../fields/inline-text-field";

// Loose RFC-5322-ish email pattern. Don't be overly strict — backend isn't
// validating either (per ARCH-11). We just want to reject obviously broken
// inputs like "foo @bar".
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PersonalInfoEditorProps {
  value: PersonalInfo | null | undefined;
  onChange: (next: PersonalInfo) => void;
  /** Fires once on every change with the email validity status. */
  onValidityChange?: (isValid: boolean) => void;
  /**
   * When the EditableTemplate has just appended a new entry, it sets a hint
   * so the relevant editor can auto-focus. For personal-info, the auto-focus
   * happens on mount (entry to Edit mode) rather than on add — so we use a
   * ref the parent can call.
   */
  firstFieldRef?: React.RefObject<HTMLInputElement | null>;
}

const EMPTY: PersonalInfo = {
  full_name: "",
  email: "",
  phone: "",
  location: "",
  social_links: [],
};

export const PersonalInfoEditor = React.memo(function PersonalInfoEditor({
  value,
  onChange,
  onValidityChange,
  firstFieldRef,
}: PersonalInfoEditorProps) {
  const tProfile = useTranslations("profile.personalInfo");
  const tValidation = useTranslations("Common.validation");
  const tEditor = useTranslations("Resumes.editor.section");
  const v = value ?? EMPTY;

  const emailError =
    v.email && v.email.trim() !== "" && !EMAIL_RE.test(v.email.trim())
      ? tValidation("invalidEmail")
      : null;

  // Notify parent of validity changes — ONLY whenever email validity flips.
  const isValid = !emailError;
  React.useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  function patch(p: Partial<PersonalInfo>) {
    onChange({ ...v, ...p });
  }

  function handleSocialAdd() {
    const newLink: SocialLink = {
      id: crypto.randomUUID(),
      platform: "",
      url: "",
    };
    onChange({ ...v, social_links: [...(v.social_links ?? []), newLink] });
  }

  function handleSocialPatch(id: string, p: Partial<SocialLink>) {
    onChange({
      ...v,
      social_links: (v.social_links ?? []).map((l) =>
        l.id === id ? { ...l, ...p } : l
      ),
    });
  }

  function handleSocialRemove(id: string) {
    onChange({
      ...v,
      social_links: (v.social_links ?? []).filter((l) => l.id !== id),
    });
  }

  function handleSocialReorder(nextIds: string[]) {
    const byId = new Map((v.social_links ?? []).map((l) => [l.id ?? "", l]));
    onChange({
      ...v,
      social_links: nextIds
        .map((id) => byId.get(id))
        .filter(Boolean) as SocialLink[],
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = (v.social_links ?? []).map((l) => l.id ?? "");
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    handleSocialReorder(arrayMove(ids, oldIdx, newIdx));
  }

  // Stamp ids on any links that arrive without one (defensive).
  const linkIds = (v.social_links ?? []).map((l) => l.id ?? "__missing");

  return (
    <header className="resume-header group/section">
      {/* Name — large heading-style input */}
      <div className="resume-name">
        <InlineTextField
          ref={firstFieldRef}
          value={v.full_name}
          onChange={(name) => patch({ full_name: name })}
          placeholder={tProfile("fullNameLabel")}
          aria-label={tProfile("fullNameLabel")}
          inputClassName="font-bold"
        />
      </div>

      {/* Contact row — inline fields with `·` separators visually */}
      <p className="resume-contact flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <ContactField
          value={v.email}
          onChange={(email) => patch({ email })}
          placeholder={tEditor("emailExamplePlaceholder")}
          ariaLabel={tProfile("emailLabel")}
          error={emailError}
        />
        <Sep />
        <ContactField
          value={v.phone}
          onChange={(phone) => patch({ phone })}
          placeholder={tProfile("phoneLabel")}
          ariaLabel={tProfile("phoneLabel")}
        />
        <Sep />
        <ContactField
          value={v.location ?? ""}
          onChange={(location) => patch({ location })}
          placeholder={tProfile("locationLabel")}
          ariaLabel={tProfile("locationLabel")}
        />
      </p>

      {/* Social links list */}
      {(v.social_links ?? []).length > 0 ? (
        <div className="mt-2 space-y-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={linkIds}
              strategy={verticalListSortingStrategy}
            >
              {(v.social_links ?? []).map((link) => (
                <SocialLinkRow
                  key={link.id ?? `__${link.url}`}
                  id={link.id ?? "__missing"}
                  platform={link.platform}
                  url={link.url}
                  onPlatformChange={(platform) =>
                    handleSocialPatch(link.id ?? "", { platform })
                  }
                  onUrlChange={(url) =>
                    handleSocialPatch(link.id ?? "", { url })
                  }
                  onRemove={() => handleSocialRemove(link.id ?? "")}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      ) : null}

      <div className="mt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSocialAdd}
          className="text-muted-foreground hover:text-foreground h-7"
        >
          <Plus className="h-3.5 w-3.5" />
          {tProfile("addSocialLink")}
        </Button>
      </div>
    </header>
  );
});

// ---------------------------------------------------------------------------
// Contact field — wraps InlineTextField for the contact row sizing
// ---------------------------------------------------------------------------

function ContactField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  error?: string | null;
}) {
  return (
    <span className="inline-flex flex-col">
      <InlineTextField
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        error={error}
        // Fixed-ish width hint per visual layout — let it grow with content.
        inputClassName="text-sm min-w-[10ch]"
      />
    </span>
  );
}

function Sep() {
  return (
    <span aria-hidden className="text-muted-foreground/60">
      ·
    </span>
  );
}

// ---------------------------------------------------------------------------
// Social link row (sortable)
// ---------------------------------------------------------------------------

interface SocialLinkRowProps {
  id: string;
  platform: string;
  url: string;
  onPlatformChange: (v: string) => void;
  onUrlChange: (v: string) => void;
  onRemove: () => void;
}

function SocialLinkRow({
  id,
  platform,
  url,
  onPlatformChange,
  onUrlChange,
  onRemove,
}: SocialLinkRowProps) {
  const tProfile = useTranslations("profile.personalInfo");
  const tEditor = useTranslations("Resumes.editor.section");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/sl flex items-center gap-2 rounded-sm py-0.5",
        isDragging && "opacity-60"
      )}
    >
      <button
        type="button"
        aria-label={tEditor("dragLink")}
        className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing opacity-0 group-hover/sl:opacity-100 focus:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <InlineTextField
        value={platform}
        onChange={onPlatformChange}
        placeholder={tEditor("platformExamplePlaceholder")}
        aria-label={tProfile("platformLabel")}
        inputClassName="text-sm w-32"
        list="social-platforms"
      />
      <datalist id="social-platforms">
        <option value="LinkedIn" />
        <option value="GitHub" />
        <option value="Website" />
        <option value="Twitter" />
        <option value="Portfolio" />
        <option value="Behance" />
        <option value="Dribbble" />
      </datalist>
      <span aria-hidden className="text-muted-foreground/60">
        ·
      </span>
      <InlineTextField
        value={url}
        onChange={onUrlChange}
        placeholder={tEditor("liveUrlPlaceholder")}
        aria-label={tProfile("urlLabel")}
        inputClassName="text-sm flex-1"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={tProfile("removeSocialLink")}
        className="rounded p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover/sl:opacity-100 focus:opacity-100 transition-opacity"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
