export interface ParsedGmapUrl {
  lat: number | null;
  lng: number | null;
}

/**
 * Rút toạ độ ra khỏi thứ người dùng dán vào ô nhập. Nhận cả hai kiểu:
 *
 * Link Google Maps đầy đủ:
 *   .../@10.7769,106.7009,17z/...
 *   ...!3d10.7769!4d106.7009...
 *   ...?q=10.7769,106.7009   |   ...&ll=10.7769,106.7009
 *
 * Hoặc toạ độ dán thẳng: "10.7769, 106.7009"
 *
 * Link rút gọn (maps.app.goo.gl) không chứa toạ độ. Không giải được ở phía trình
 * duyệt vì Google chặn CORS nên không đọc được đích của redirect — muốn tự động
 * thì phải có backend đứng ra gọi hộ.
 */
export function parseGmapUrl(input: string): ParsedGmapUrl {
  const empty: ParsedGmapUrl = { lat: null, lng: null };
  const text = input?.trim();
  if (!text) return empty;

  const patterns: RegExp[] = [
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|ll|center|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
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
