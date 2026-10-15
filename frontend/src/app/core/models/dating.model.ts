import { PlaceType, PriceRange } from './place.model';
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

/** Quán cả hai cùng lưu trong My place. `district`: tên quận để hiển thị. */
export interface SharedPlace {
  catalogId: string;
  name: string;
  type: PlaceType;
  district: string;
  priceRange: PriceRange;
}

/**
 * Một thẻ hồ sơ để quẹt, hoặc người trong một match, nhìn từ phía mình. `sharedPlaces`: quán cùng lưu
 * (chỉ phần giao nhau); `fit`: % hợp gu theo số quán cùng lưu (0 = chưa có quán chung); `superLikedMe`:
 * người này đã siêu thích mình.
 */
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
  sharedPlaces: SharedPlace[];
  fit: number;
  superLikedMe: boolean;
}

/** Trong ngày (giờ Việt Nam): số người đã thích, số lượt siêu thích còn lại. */
export interface TodayStats {
  liked: number;
  superLikesLeft: number;
}

export interface Match {
  id: string;
  user: Candidate;
  matchedAt: string;
  /** Tin nhắn gần nhất (null: chưa nhắn) */
  lastMessage: { body: string; mine: boolean; at: string } | null;
  /** Số tin người kia gửi mà mình chưa xem */
  unread: number;
}

/** Một tin nhắn trong cuộc trò chuyện của một match. */
export interface ChatMessage {
  id: string;
  senderId: string;
  mine: boolean;
  body: string;
  createdAt: string;
  /** Người nhận đã xem lúc nào (null: chưa xem) */
  readAt: string | null;
  /** Tin "Rủ đi" kèm plan (null: tin thường, hoặc plan đã bị xoá) */
  plan?: { id: string; title: string; date: string | null; stopCount: number } | null;
}

export const MESSAGE_MAX = 2000;

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
  totalUsers: number;
  /** Chưa có dòng hồ sơ (mới đăng ký, chưa vào sửa hồ sơ) */
  noProfile: number;
  /** Có hồ sơ nhưng thiếu ảnh / ngày sinh, chưa bật được Tìm đối tượng */
  incompleteProfiles: number;
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

/** Trạng thái Tìm đối tượng của một tài khoản (trang Người dùng của admin) */
export type DatingStatus = 'NO_PROFILE' | 'INCOMPLETE' | 'OFF' | 'ON' | 'BANNED';

export const DATING_STATUSES: { value: DatingStatus; label: string; tone: string }[] = [
  { value: 'ON', label: 'Đang bật', tone: 'bg-emerald-50 text-emerald-700' },
  { value: 'OFF', label: 'Chưa bật', tone: 'bg-slate-100 text-slate-600' },
  { value: 'INCOMPLETE', label: 'Hồ sơ thiếu', tone: 'bg-amber-50 text-amber-700' },
  { value: 'NO_PROFILE', label: 'Chưa có hồ sơ', tone: 'bg-slate-100 text-slate-500' },
  { value: 'BANNED', label: 'Bị khoá', tone: 'bg-rose-50 text-rose-700' },
];

export interface DatingUserRow {
  user: AdminPerson;
  username: string | null;
  role: 'ADMIN' | 'GUEST' | string;
  createdAt: string;
  city: string | null;
  status: DatingStatus;
  enabled: boolean;
  banned: boolean;
  likesGiven: number;
  likesReceived: number;
  matches: number;
  reportsAgainst: number;
}

/** Hồ sơ đầy đủ và mức dùng app của một người (trang chi tiết) */
export interface AdminUserDetail {
  gender: string | null;
  birthday: string | null;
  phone: string | null;
  bio: string | null;
  /** Còn thiếu gì để bật Tìm đối tượng */
  missing: string[];
  savedPlaces: number;
  savedSpots: number;
  plans: number;
}

export interface DatingActivity {
  summary: DatingUserRow;
  detail: AdminUserDetail;
  likesGiven: ActivityEdge[];
  likesReceived: ActivityEdge[];
  matches: ActivityEdge[];
  /** Các báo cáo về người này */
  reports: DatingReport[];
}

/** Một người trong hoạt động của ai đó; {@code matchId} chỉ có ở danh sách match (để xem tin nhắn). */
export interface ActivityEdge {
  user: AdminPerson;
  at: string;
  matchId: string | null;
}

export interface SwipeResult {
  matched: boolean;
  match: Match | null;
}
