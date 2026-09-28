package com.gfmaster.messaging;

/**
 * Tên exchange/queue RabbitMQ.
 *
 * <pre>
 * gfm.events (topic)
 *   image.uploaded           → gfm.image.variants   (sinh thumbnail)
 *   upload.deleted           → gfm.storage.cleanup  (xoá file)
 *   place.* | girlfriend.*   → gfm.cache.evict      (xoá cache /stats)
 *   import.requested         → gfm.import           (nhập dữ liệu localStorage cũ, prefetch 1)
 * gfm.dlx (direct): message lỗi hết lượt retry → &lt;queue&gt;.dlq
 * </pre>
 */
public final class Topology {

  public static final String EVENTS = "gfm.events";
  public static final String DLX = "gfm.dlx";

  public static final String IMAGE_VARIANTS = "gfm.image.variants";
  public static final String STORAGE_CLEANUP = "gfm.storage.cleanup";
  public static final String CACHE_EVICT = "gfm.cache.evict";
  public static final String IMPORT = "gfm.import";

  public static final String USER_ID_HEADER = "x-user-id";

  private Topology() {}

  public static String dlq(String queue) {
    return queue + ".dlq";
  }
}
