
export type Gender = 'male' | 'female' | 'other';

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Nữ' },
  { value: 'male', label: 'Nam' },
  { value: 'other', label: 'Khác' },
];

/** Hồ sơ cá nhân. `version === null`: người dùng chưa lưu hồ sơ lần nào. */
export interface Profile {
  displayName: string;
  avatarUrl: string | null;
  birthday: string | null;
  gender: Gender | null;
  phone: string | null;
  city: string | null;
  bio: string;
  /** Ảnh thêm ngoài ảnh đại diện (tối đa 6), hiện trên thẻ "Tìm đối tượng" */
  photos: string[];
  /** Sở thích dạng thẻ (tối đa 10) */
  interests: string[];
  completedAt: string | null;
  version: number | null;
}

export type ProfileRequest = Omit<Profile, 'completedAt'>;
