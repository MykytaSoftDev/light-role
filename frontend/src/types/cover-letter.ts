// Cover letter feature type definitions matching backend Pydantic schemas

export type CLStyle = 'formal' | 'professional' | 'job_matched';
export type CLTone = 'confident' | 'humble' | 'enthusiastic';
export type CLLength = 'short' | 'medium' | 'long';

export interface CoverLetterVariant {
  content: string;
  label: string;
}

export interface CoverLetterListItem {
  id: string;
  name: string;
  job_id: string | null;
  style: CLStyle;
  tone: CLTone;
  length_setting: CLLength;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoverLetterResponse {
  id: string;
  user_id: string;
  job_id: string | null;
  resume_id: string | null;
  name: string;
  content: string;
  variants: CoverLetterVariant[];
  selected_variant_index: number | null;
  style: CLStyle;
  tone: CLTone;
  length_setting: CLLength;
  additional_context: string | null;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateVariantsResponse {
  cover_letter_id: string;
  variants: CoverLetterVariant[];
}
