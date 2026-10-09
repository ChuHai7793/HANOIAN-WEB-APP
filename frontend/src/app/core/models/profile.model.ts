import { Role } from '../auth/auth.service';

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
  completedAt: string | null;
  version: number | null;
}

export type ProfileRequest = Omit<Profile, 'completedAt'>;

/** Một dòng trong trang "Người dùng" của admin. */
export interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  role: Role;
  createdAt: string;
  profile: Profile;
}
