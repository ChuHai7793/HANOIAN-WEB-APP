import { Gender } from './profile.model';

export type DatingInterest = 'male' | 'female' | 'all';

/** Cài đặt "Tìm đối tượng". `missing`: những gì còn thiếu để bật được (rỗng = bật được). */
export interface DatingSettings {
  enabled: boolean;
  interestedIn: DatingInterest;
  ageMin: number;
  ageMax: number;
  sameCityOnly: boolean;
  missing: string[];
}

export type DatingSettingsRequest = Omit<DatingSettings, 'missing'>;

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

export interface SwipeResult {
  matched: boolean;
  match: Match | null;
}
