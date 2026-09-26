export interface CompressOptions {
  /** Cạnh dài nhất sau khi thu nhỏ, px */
  maxSize?: number;
  /** Chất lượng nén, 0..1 */
  quality?: number;
}

/** Giới hạn kích thước file gốc được chấp nhận, tránh treo trình duyệt */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * Đọc file ảnh từ máy, thu nhỏ và nén thành data URL để nhét vừa localStorage.
 * Ảnh 4MB từ điện thoại thường còn khoảng 40–90KB sau bước này.
 */
export async function fileToCompressedDataUrl(
  file: File,
  options: CompressOptions = {},
): Promise<string> {
  const { maxSize = 800, quality = 0.75 } = options;

  if (!file.type.startsWith('image/')) {
    throw new Error('File này không phải ảnh.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Ảnh lớn hơn 12MB, hãy chọn ảnh nhẹ hơn.');
  }

  const img = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');

  // Nền trắng để ảnh PNG trong suốt không bị đen khi xuất sang JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // WebP nén tốt hơn JPEG khoảng 25%; trình duyệt nào không hỗ trợ thì tự rơi về JPEG
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Không đọc được file ảnh này.'));
    };
    img.src = objectUrl;
  });
}

/** Ước lượng dung lượng thật của một chuỗi data URL base64 */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
