export interface CompressOptions {
  /** Cạnh dài nhất sau khi thu nhỏ, px */
  maxSize?: number;
  /** Chất lượng nén, 0..1 */
  quality?: number;
}

/** Giới hạn kích thước file gốc được chấp nhận, khớp với giới hạn upload của server */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * Thu nhỏ và nén ảnh ngay trên trình duyệt trước khi upload để tiết kiệm băng thông.
 * Server vẫn tự xử lý lại (xoay EXIF, resize, WebP), nên đây chỉ là bước tối ưu.
 */
export async function fileToCompressedBlob(
  file: File,
  options: CompressOptions = {},
): Promise<Blob> {
  const { maxSize = 1200, quality = 0.85 } = options;

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
  const webp = await canvasToBlob(canvas, 'image/webp', quality);
  if (webp?.type === 'image/webp') return webp;
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
  if (!jpeg) throw new Error('Không nén được ảnh này.');
  return jpeg;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
