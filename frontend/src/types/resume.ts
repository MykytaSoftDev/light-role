// Resume feature type definitions matching backend Pydantic schemas

export interface PersonalInfo {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  website: string | null;
  summary: string | null;
}

export interface ExperienceItem {
  company: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  current: boolean;
  description: string;
  achievements: string[];
}

export interface EducationItem {
  institution: string;
  degree: string;
  field: string | null;
  start_date: string | null;
  end_date: string | null;
  gpa: string | null;
}

export interface CertificationItem {
  name: string;
  issuer: string | null;
  date: string | null;
}

export interface ResumeData {
  personal_info: PersonalInfo;
  summary: string | null;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  languages: string[];
  certifications: CertificationItem[];
}

export interface ResumeListItem {
  id: string;
  name: string;
  job_id: string | null;
  match_score: number | null;
  is_base: boolean;
  original_file_format: 'pdf' | 'docx';
  template: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeResponse {
  id: string;
  user_id: string;
  name: string;
  job_id: string | null;
  original_file_format: 'pdf' | 'docx';
  parsed_data: ResumeData | null;
  optimized_data: ResumeData | null;
  match_score: number | null;
  ai_recommendations: {
    keyword_gaps: string[];
    recommendations: string[];
  } | null;
  sections_order: string[];
  is_base: boolean;
  template: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeAnalysisResponse {
  resume_id: string;
  match_score: number;
  keyword_gaps: string[];
  recommendations: string[];
  parsed_data: ResumeData;
  optimized_data: ResumeData;
}

export interface ResumeUpdatePayload {
  name?: string;
  parsed_data?: ResumeData;
  sections_order?: string[];
  template?: string;
}
