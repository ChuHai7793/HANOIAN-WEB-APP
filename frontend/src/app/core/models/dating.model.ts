import { Gender } from './profile.model';

export type DatingInterest = 'male' | 'female' | 'all';

/** Cài đặt "Tìm đối tượng". `missing`: những gì còn thiếu để bật được (rỗng = bật được). */
export interface DatingSettings {
  enabled: boolean;
  /** Admin đã khoá khỏi mục này */
  banned: boolean;
  interestedIn: DatingInterest;
  ageMin: number;
  ageMax: number;
  sameCityOnly: boolean;
  missing: string[];
}

export type DatingSettingsRequest = Omit<DatingSettings, 'missing' | 'banned'>;

/** Một thẻ hồ sơ để quẹt, hoặc người trong một match. */
export interface Candidate {
  userId: string;
  displayName: string;
  age: number;
  gender: Gender | null;
  city: string | null;
  bio: string | null;
  avatarUrl: string | null;
  photos: string[];
  interests: string[];
}

export interface Match {
  id: string;
  user: Candidate;
  matchedAt: string;
}

export type ReportReason = 'fake_profile' | 'inappropriate' | 'harassment' | 'spam' | 'underage' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'fake_profile', label: 'Hồ sơ giả' },
  { value: 'inappropriate', label: 'Ảnh / nội dung không phù hợp' },
  { value: 'harassment', label: 'Quấy rối' },
  { value: 'spam', label: 'Spam / lừa đảo' },
  { value: 'underage', label: 'Dưới 18 tuổi' },
  { value: 'other', label: 'Khác' },
];

// ---- Quản trị ----

export interface AdminPerson {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export interface DatingStats {
  enabledUsers: number;
  bannedUsers: number;
  swipes: number;
  likes: number;
  matches: number;
  openReports: number;
}

export interface DatingReport {
  id: string;
  reporter: AdminPerson;
  reported: AdminPerson;
  reason: ReportReason;
  note: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
}

export interface DatingUserRow {
  user: AdminPerson;
  enabled: boolean;
  banned: boolean;
  likesGiven: number;
  likesReceived: number;
  matches: number;
  reportsAgainst: number;
}

export interface DatingActivity {
  summary: DatingUserRow;
  likesGiven: { user: AdminPerson; at: string }[];
  likesReceived: { user: AdminPerson; at: string }[];
  matches: { user: AdminPerson; at: string }[];
}

export interface SwipeResult {
  matched: boolean;
  match: Match | null;
}
