export interface ParsedGmapUrl {
  lat: number | null;
  lng: number | null;
}

/**
 * Rút toạ độ ra khỏi thứ người dùng dán vào ô nhập. Nhận cả hai kiểu:
 *
 * Link Google Maps đầy đủ:
 *   ...!3d10.7769!4d106.7009...      (vị trí ghim của địa điểm, ưu tiên)
 *   .../@10.7769,106.7009,17z/...    (tâm khung bản đồ, có thể lệch khỏi quán)
 *   ...?q=10.7769,106.7009   |   &ll=   |   &query=   |   /maps/search/10.77,+106.70
 *
 * Hoặc toạ độ dán thẳng: "10.7769, 106.7009"
 *
 * Cùng quy tắc với GmapUrlParser ở backend. Link rút gọn (maps.app.goo.gl) không chứa
 * toạ độ và trình duyệt không tự giải được (CORS): dùng MapsService gọi /maps/resolve.
 */
export function parseGmapUrl(input: string): ParsedGmapUrl {
  const empty: ParsedGmapUrl = { lat: null, lng: null };
  const text = safeDecode(input?.trim() ?? '');
  if (!text) return empty;

  const patterns: RegExp[] = [
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&](?:q|ll|center|destination|query)=(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/,
    /\/maps\/search\/(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (isValidCoordinate(lat, lng)) return { lat, lng };
    }
  }
  return empty;
}

/** Link rút gọn của Google Maps: không có toạ độ, phải nhờ server giải. */
export function isShortMapsLink(input: string): boolean {
  return /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(input?.trim() ?? '');
}

/** "%2C" → ",", "+" → " ". Chuỗi % hỏng thì giữ nguyên. */
function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Link chỉ đường tới quán, ưu tiên toạ độ, không có thì dùng địa chỉ */
export function directionsUrl(
  lat: number | null,
  lng: number | null,
  fallbackQuery: string,
): string {
  const destination =
    lat !== null && lng !== null ? `${lat},${lng}` : fallbackQuery.trim();
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Link xem quán trên Google Maps */
export function viewOnMapUrl(
  lat: number | null,
  lng: number | null,
  fallbackQuery: string,
): string {
  const query = lat !== null && lng !== null ? `${lat},${lng}` : fallbackQuery.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Link nhúng iframe, không cần API key */
export function embedMapUrl(
  lat: number | null,
  lng: number | null,
  fallbackQuery: string,
): string {
  const query = lat !== null && lng !== null ? `${lat},${lng}` : fallbackQuery.trim();
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}

/** Link lộ trình nhiều điểm: đi quán ăn rồi qua quán cafe */
export function routeUrl(stops: { lat: number | null; lng: number | null; name: string }[]): string {
  const points = stops.map((s) =>
    s.lat !== null && s.lng !== null ? `${s.lat},${s.lng}` : s.name,
  );
  if (points.length < 2) return '';
  const origin = encodeURIComponent(points[0]);
  const destination = encodeURIComponent(points[points.length - 1]);
  const waypoints = points
    .slice(1, -1)
    .map((p) => encodeURIComponent(p))
    .join('|');
  const waypointParam = waypoints ? `&waypoints=${waypoints}` : '';
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointParam}`;
}
