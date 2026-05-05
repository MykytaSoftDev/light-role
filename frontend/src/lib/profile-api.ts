import { api } from "./api";

// ---------------------------------------------------------------------------
// Types — mirror backend/app/schemas/profile.py
// ---------------------------------------------------------------------------

export interface SocialLink {
  id?: string;
  platform: string;
  url: string;
}

export interface PersonalInfo {
  full_name: string;
  email: string;
  phone: string;
  location?: string | null;
  social_links: SocialLink[];
}

export interface SkillEntry {
  id?: string;
  name: string;
  category?: string | null;
  level?: string | null;
}

export interface LanguageEntry {
  id?: string;
  name: string;
}

export interface EmploymentEntry {
  id?: string;
  role: string;
  company: string;
  location?: string | null;
  start_date: string; // "YYYY-MM"
  end_date?: string | null;
  is_current?: boolean;
  details: string[];
}

export interface EducationEntry {
  id?: string;
  degree: string;
  institution: string;
  field_of_study?: string | null;
  location?: string | null;
  start_date: string;
  end_date?: string | null;
  is_current?: boolean;
  description?: string | null;
}

export interface ProjectEntry {
  id?: string;
  name: string;
  description: string;
  role?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  technologies: string[];
  url?: string | null;
  repository_url?: string | null;
  details: string[];
}

export interface CertificateEntry {
  id?: string;
  name: string;
  issuer?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  credential_url?: string | null;
}

export interface AchievementEntry {
  id?: string;
  title: string;
  description?: string | null;
  date?: string | null;
  issuer?: string | null;
}

export interface VolunteerEntry {
  id?: string;
  role: string;
  organization: string;
  location?: string | null;
  start_date: string;
  end_date?: string | null;
  is_current?: boolean;
  details: string[];
}

export interface ProfileData {
  personal_info?: PersonalInfo | null;
  summary: string;
  employment: EmploymentEntry[];
  education: EducationEntry[];
  skills: SkillEntry[];
  projects: ProjectEntry[];
  languages: LanguageEntry[];
  certificates: CertificateEntry[];
  achievements: AchievementEntry[];
  volunteer: VolunteerEntry[];
}

export interface ProfileResponse {
  id: string;
  user_id: string;
  profile_data: ProfileData;
  created_at: string;
  updated_at: string;
}

export interface ProfilePatchRequest {
  personal_info?: PersonalInfo;
  summary?: string;
  employment?: EmploymentEntry[];
  education?: EducationEntry[];
  skills?: SkillEntry[];
  projects?: ProjectEntry[];
  languages?: LanguageEntry[];
  certificates?: CertificateEntry[];
  achievements?: AchievementEntry[];
  volunteer?: VolunteerEntry[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<ProfileResponse> {
  const res = await api.get("/api/v1/profile");
  if (!res.ok) throw new Error(`Failed to fetch profile: HTTP ${res.status}`);
  return res.json();
}

export async function patchProfile(
  patch: ProfilePatchRequest
): Promise<ProfileResponse> {
  const res = await api.patch("/api/v1/profile", patch);
  if (!res.ok) throw new Error(`Failed to update profile: HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when `profile_data` has no user-entered content. Used to decide
 * whether to show the empty-state "Upload resume / Start manually" picker
 * versus the regular tabbed editor on /dashboard/profile.
 *
 * A profile counts as empty when EVERY one of these is falsy:
 *   - personal_info has no full_name/email/phone/location and no social_links
 *   - summary is empty/whitespace
 *   - employment, education, skills, projects, languages, certificates,
 *     achievements, volunteer are all empty arrays
 */
export function isProfileEmpty(
  data: ProfileData | null | undefined
): boolean {
  if (!data) return true;
  const pi = data.personal_info;
  const hasPI =
    pi &&
    ((pi.full_name?.trim() ?? "") !== "" ||
      (pi.email?.trim() ?? "") !== "" ||
      (pi.phone?.trim() ?? "") !== "" ||
      (pi.location?.trim() ?? "") !== "" ||
      (pi.social_links?.length ?? 0) > 0);
  if (hasPI) return false;
  if ((data.summary ?? "").trim() !== "") return false;
  if ((data.employment ?? []).length > 0) return false;
  if ((data.education ?? []).length > 0) return false;
  if ((data.skills ?? []).length > 0) return false;
  if ((data.projects ?? []).length > 0) return false;
  if ((data.languages ?? []).length > 0) return false;
  if ((data.certificates ?? []).length > 0) return false;
  if ((data.achievements ?? []).length > 0) return false;
  if ((data.volunteer ?? []).length > 0) return false;
  return true;
}

export async function resetProfile(file: File): Promise<ProfileResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await api.postMultipart("/api/v1/profile/reset", fd);
  if (!res.ok) {
    let message = `Failed to reset profile: HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail && typeof body.detail === "string") message = body.detail;
    } catch {
      /* swallow JSON parse errors — fall back to generic message */
    }
    throw new Error(message);
  }
  return res.json();
}
