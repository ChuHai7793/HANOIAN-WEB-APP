package com.gfmaster.plan;

import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.plan.PlanDtos.PlanStatus;
import com.gfmaster.plan.PlanDtos.StopKind;
import com.gfmaster.spot.SpotCategory;
import com.gfmaster.upload.storage.ImageUrls;
import com.gfmaster.vibe.Vibe;
import com.gfmaster.vibe.VibeConverters;
import java.math.BigDecimal;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Plan, điểm dừng và danh sách địa điểm (quán + chỗ chơi) cho plan. */
@Repository
public class PlanRepository {

  private final NamedParameterJdbcTemplate jdbc;
  private final ImageUrls imageUrls;

  public PlanRepository(NamedParameterJdbcTemplate jdbc, ImageUrls imageUrls) {
    this.jdbc = jdbc;
    this.imageUrls = imageUrls;
  }

  public record PlanRow(
      UUID id,
      UUID userId,
      String ownerName,
      String title,
      LocalDate date,
      LocalTime startTime,
      CatalogDistrict district,
      String note,
      PlanStatus status,
      String memory,
      Vibe vibe,
      Integer budget,
      boolean rainy,
      long version,
      Instant createdAt,
      Instant updatedAt) {}

  public record StopRow(
      UUID id, int position, UUID catalogId, UUID spotId, int durationMin, String note, Integer rating, String memory) {

    StopKind kind() {
      return catalogId != null ? StopKind.place : StopKind.spot;
    }

    UUID refId() {
      return catalogId != null ? catalogId : spotId;
    }
  }

  /** Các field của plan khi thêm / sửa */
  public record PlanFields(
      String title,
      LocalDate date,
      LocalTime startTime,
      CatalogDistrict district,
      String note,
      PlanStatus status,
      String memory,
      Vibe vibe,
      Integer budget,
      boolean rainy) {}

  // ---- Plan ----

  public UUID insertPlan(UUID userId, PlanFields f) {
    UUID id = UUID.randomUUID();
    Map<String, Object> p = params(f);
    p.put("id", id);
    p.put("user", userId);
    jdbc.update(
        """
        INSERT INTO plans (id, user_id, title, plan_date, start_time, district, note, status, memory, vibe, budget,
                           rainy, created_at, updated_at, version)
        VALUES (:id, :user, :title, :date, :start, :district, :note, :status, :memory, :vibe, :budget, :rainy,
                now(), now(), 0)
        """,
        p);
    return id;
  }

  /** Sửa khi đúng chủ và đúng version; trả false nếu lệch version. */
  public boolean updatePlan(UUID id, PlanFields f, long version) {
    Map<String, Object> p = params(f);
    p.put("id", id);
    p.put("version", version);
    return jdbc.update(
            """
            UPDATE plans SET title = :title, plan_date = :date, start_time = :start, district = :district,
                             note = :note, status = :status, memory = :memory, vibe = :vibe, budget = :budget,
                             rainy = :rainy, updated_at = now(), version = version + 1
            WHERE id = :id AND version = :version
            """,
            p)
        > 0;
  }

  /** Điểm dừng thay đổi: cập nhật thời điểm sửa (version không đổi để không làm hỏng form đang mở) */
  public void touch(UUID id) {
    jdbc.update("UPDATE plans SET updated_at = now() WHERE id = :id", Map.of("id", id));
  }

  public void setStatus(UUID id, PlanStatus status) {
    jdbc.update(
        "UPDATE plans SET status = :status, updated_at = now(), version = version + 1 WHERE id = :id",
        Map.of("id", id, "status", status.name()));
  }

  public boolean deletePlan(UUID id, UUID userId) {
    return jdbc.update("DELETE FROM plans WHERE id = :id AND user_id = :user", Map.of("id", id, "user", userId)) > 0;
  }

  public Optional<PlanRow> plan(UUID id) {
    return jdbc.query(
            "SELECT p.*, u.display_name AS owner_name FROM plans p JOIN users u ON u.id = p.user_id WHERE p.id = :id",
            Map.of("id", id),
            (rs, i) -> planRow(rs))
        .stream()
        .findFirst();
  }

  public List<PlanRow> plansOf(UUID userId) {
    return jdbc.query(
        """
        SELECT p.*, u.display_name AS owner_name FROM plans p JOIN users u ON u.id = p.user_id
        WHERE p.user_id = :user ORDER BY p.updated_at DESC
        """,
        Map.of("user", userId),
        (rs, i) -> planRow(rs));
  }

  /** Người xem được plan: chủ plan, hoặc người trong một match có tin "Rủ đi" kèm plan này. */
  public boolean sharedWith(UUID planId, UUID viewer) {
    Long n =
        jdbc.queryForObject(
            """
            SELECT count(*) FROM messages m JOIN matches x ON x.id = m.match_id
            WHERE m.plan_id = :plan AND (x.user_a = :viewer OR x.user_b = :viewer)
            """,
            Map.of("plan", planId, "viewer", viewer),
            Long.class);
    return n != null && n > 0;
  }

  // ---- Điểm dừng ----

  public List<StopRow> stops(UUID planId) {
    return jdbc.query(
        "SELECT * FROM plan_stops WHERE plan_id = :plan ORDER BY position, id",
        Map.of("plan", planId),
        (rs, i) ->
            new StopRow(
                rs.getObject("id", UUID.class),
                rs.getInt("position"),
                rs.getObject("catalog_id", UUID.class),
                rs.getObject("spot_id", UUID.class),
                rs.getInt("duration_min"),
                rs.getString("note"),
                (Integer) rs.getObject("rating", Integer.class),
                rs.getString("memory")));
  }

  /** Số điểm và tên vài điểm đầu của nhiều plan (danh sách plan) */
  public Map<UUID, List<String>> stopNames(List<UUID> planIds) {
    Map<UUID, List<String>> out = new HashMap<>();
    if (planIds.isEmpty()) return out;
    jdbc.query(
        """
        SELECT s.plan_id, coalesce(c.name, d.name) AS name FROM plan_stops s
        LEFT JOIN place_catalog c ON c.id = s.catalog_id LEFT JOIN date_spots d ON d.id = s.spot_id
        WHERE s.plan_id IN (:ids) ORDER BY s.plan_id, s.position
        """,
        Map.of("ids", planIds),
        rs -> {
          out.computeIfAbsent(rs.getObject("plan_id", UUID.class), k -> new ArrayList<>()).add(rs.getString("name"));
        });
    return out;
  }

  public UUID insertStop(UUID planId, int position, StopKind kind, UUID refId, int durationMin) {
    jdbc.update(
        "UPDATE plan_stops SET position = position + 1 WHERE plan_id = :plan AND position >= :pos",
        Map.of("plan", planId, "pos", position));
    UUID id = UUID.randomUUID();
    Map<String, Object> p = new HashMap<>();
    p.put("id", id);
    p.put("plan", planId);
    p.put("pos", position);
    p.put("catalog", kind == StopKind.place ? refId : null);
    p.put("spot", kind == StopKind.spot ? refId : null);
    p.put("minutes", durationMin);
    jdbc.update(
        """
        INSERT INTO plan_stops (id, plan_id, position, catalog_id, spot_id, duration_min)
        VALUES (:id, :plan, :pos, :catalog, :spot, :minutes)
        """,
        p);
    return id;
  }

  public void updateStop(UUID stopId, int durationMin, String note, Integer rating, String memory) {
    Map<String, Object> p = new HashMap<>();
    p.put("id", stopId);
    p.put("minutes", durationMin);
    p.put("note", note);
    p.put("rating", rating);
    p.put("memory", memory);
    jdbc.update(
        "UPDATE plan_stops SET duration_min = :minutes, note = :note, rating = :rating, memory = :memory WHERE id = :id",
        p);
  }

  /** Đổi điểm sang địa điểm khác, giữ vị trí và ghi chú */
  public void replaceStop(UUID stopId, StopKind kind, UUID refId, int durationMin) {
    Map<String, Object> p = new HashMap<>();
    p.put("id", stopId);
    p.put("catalog", kind == StopKind.place ? refId : null);
    p.put("spot", kind == StopKind.spot ? refId : null);
    p.put("minutes", durationMin);
    jdbc.update(
        "UPDATE plan_stops SET catalog_id = :catalog, spot_id = :spot, duration_min = :minutes, rating = NULL, memory = '' WHERE id = :id",
        p);
  }

  public void deleteStop(UUID planId, UUID stopId) {
    jdbc.update("DELETE FROM plan_stops WHERE id = :id AND plan_id = :plan", Map.of("id", stopId, "plan", planId));
    renumber(planId);
  }

  /** Xếp lại theo thứ tự {@code ids} (phải đúng là các điểm của plan). */
  public void reorder(UUID planId, List<UUID> ids) {
    for (int i = 0; i < ids.size(); i++) {
      jdbc.update(
          "UPDATE plan_stops SET position = :pos WHERE id = :id AND plan_id = :plan",
          Map.of("pos", i, "id", ids.get(i), "plan", planId));
    }
  }

  private void renumber(UUID planId) {
    jdbc.update(
        """
        UPDATE plan_stops s SET position = r.rn - 1
        FROM (SELECT id, row_number() OVER (ORDER BY position, id) AS rn FROM plan_stops WHERE plan_id = :plan) r
        WHERE s.id = r.id
        """,
        Map.of("plan", planId));
  }

  /** Sao chép điểm của một plan sang plan khác (người được rủ "Lưu về plan của tôi") */
  public void copyStops(UUID fromPlan, UUID toPlan) {
    jdbc.update(
        """
        INSERT INTO plan_stops (id, plan_id, position, catalog_id, spot_id, duration_min, note)
        SELECT gen_random_uuid(), :to, position, catalog_id, spot_id, duration_min, note
        FROM plan_stops WHERE plan_id = :from
        """,
        Map.of("from", fromPlan, "to", toPlan));
  }

  // ---- Địa điểm ----

  private static final String PLACE_SQL =
      """
      SELECT 'place' AS kind, id, type AS place_type, NULL AS spot_category, name, address, district, image_url,
             lat, lng, open_time, close_time, true AS indoor, false AS needs_booking, vibes, google_maps_url,
             rating, price_range, 0 AS price_from, NULL::smallint AS duration_min
      FROM place_catalog
      """;

  private static final String SPOT_SQL =
      """
      SELECT 'spot' AS kind, id, NULL AS place_type, category AS spot_category, name, address, district, image_url,
             lat, lng, open_time, close_time, indoor, needs_booking, vibes, google_maps_url,
             NULL::int AS rating, NULL AS price_range, price_from, duration_min
      FROM date_spots
      """;

  /** Mọi quán và chỗ chơi (cho Autoplan / Đổi). Danh mục nhỏ (vài trăm dòng) nên lấy hết một lần. */
  public List<Venue> venues() {
    return jdbc.query(PLACE_SQL + " UNION ALL " + SPOT_SQL, Map.of(), (rs, i) -> venue(rs));
  }

  public Map<UUID, Venue> venuesByIds(List<UUID> catalogIds, List<UUID> spotIds) {
    Map<UUID, Venue> out = new HashMap<>();
    if (!catalogIds.isEmpty()) {
      jdbc.query(PLACE_SQL + " WHERE id IN (:ids)", Map.of("ids", catalogIds), (rs, i) -> venue(rs))
          .forEach(v -> out.put(v.id(), v));
    }
    if (!spotIds.isEmpty()) {
      jdbc.query(SPOT_SQL + " WHERE id IN (:ids)", Map.of("ids", spotIds), (rs, i) -> venue(rs))
          .forEach(v -> out.put(v.id(), v));
    }
    return out;
  }

  public Optional<Venue> venue(StopKind kind, UUID id) {
    List<UUID> ids = List.of(id);
    return Optional.ofNullable(
        (kind == StopKind.place ? venuesByIds(ids, List.of()) : venuesByIds(List.of(), ids)).get(id));
  }

  // ---- Lưu kỷ niệm vào Người yêu ----

  public boolean girlfriendOf(UUID girlfriendId, UUID userId) {
    Long n =
        jdbc.queryForObject(
            "SELECT count(*) FROM girlfriends WHERE id = :id AND user_id = :user",
            Map.of("id", girlfriendId, "user", userId),
            Long.class);
    return n != null && n > 0;
  }

  /** Quán trong My place của người dùng tương ứng với một quán trong Khám phá quán */
  public Optional<UUID> myPlaceFor(UUID userId, UUID catalogId) {
    return jdbc.queryForList(
            "SELECT id FROM places WHERE user_id = :user AND catalog_id = :catalog",
            Map.of("user", userId, "catalog", catalogId),
            UUID.class)
        .stream()
        .findFirst();
  }

  /** Ghi kỷ niệm của người yêu tại một quán: có rồi thì cập nhật, chưa có thì thêm. */
  public void upsertLink(UUID girlfriendId, UUID placeId, int rating, LocalDate visited, String memory) {
    Map<String, Object> p = new HashMap<>();
    p.put("id", UUID.randomUUID());
    p.put("gf", girlfriendId);
    p.put("place", placeId);
    p.put("rating", rating);
    p.put("visited", visited == null ? null : Date.valueOf(visited));
    p.put("memory", memory);
    jdbc.update(
        """
        INSERT INTO place_links (id, girlfriend_id, place_id, her_rating, last_visited_at, memory, created_at,
                                 updated_at, version)
        VALUES (:id, :gf, :place, :rating, :visited, :memory, now(), now(), 0)
        ON CONFLICT (girlfriend_id, place_id) DO UPDATE SET
          her_rating = EXCLUDED.her_rating,
          last_visited_at = EXCLUDED.last_visited_at,
          memory = CASE WHEN EXCLUDED.memory = '' THEN place_links.memory
                        WHEN place_links.memory = '' THEN EXCLUDED.memory
                        ELSE place_links.memory || E'\\n\\n' || EXCLUDED.memory END,
          updated_at = now(),
          version = place_links.version + 1
        """,
        p);
  }

  // ---- Mapping ----

  private Venue venue(ResultSet rs) throws SQLException {
    boolean place = "place".equals(rs.getString("kind"));
    String placeType = rs.getString("place_type");
    String category = rs.getString("spot_category");
    String price = rs.getString("price_range");
    return new Venue(
        place ? StopKind.place : StopKind.spot,
        rs.getObject("id", UUID.class),
        placeType == null ? null : PlaceType.valueOf(placeType),
        category == null ? null : SpotCategory.valueOf(category),
        rs.getString("name"),
        rs.getString("address"),
        CatalogDistrict.valueOf(rs.getString("district")),
        imageUrls.toPublic(rs.getString("image_url")),
        toDouble(rs.getBigDecimal("lat")),
        toDouble(rs.getBigDecimal("lng")),
        toTime(rs.getTime("open_time")),
        toTime(rs.getTime("close_time")),
        rs.getBoolean("indoor"),
        rs.getBoolean("needs_booking"),
        VibeConverters.split(rs.getString("vibes")),
        rs.getString("google_maps_url"),
        (Integer) rs.getObject("rating", Integer.class),
        price == null ? null : PriceRange.valueOf(price),
        rs.getInt("price_from"),
        (Integer) rs.getObject("duration_min", Integer.class));
  }

  private static PlanRow planRow(ResultSet rs) throws SQLException {
    String district = rs.getString("district");
    String vibe = rs.getString("vibe");
    Date date = rs.getDate("plan_date");
    return new PlanRow(
        rs.getObject("id", UUID.class),
        rs.getObject("user_id", UUID.class),
        rs.getString("owner_name"),
        rs.getString("title"),
        date == null ? null : date.toLocalDate(),
        rs.getTime("start_time").toLocalTime(),
        district == null ? null : CatalogDistrict.valueOf(district),
        rs.getString("note"),
        PlanStatus.valueOf(rs.getString("status")),
        rs.getString("memory"),
        vibe == null ? null : Vibe.valueOf(vibe),
        (Integer) rs.getObject("budget", Integer.class),
        rs.getBoolean("rainy"),
        rs.getLong("version"),
        toInstant(rs.getTimestamp("created_at")),
        toInstant(rs.getTimestamp("updated_at")));
  }

  private static Map<String, Object> params(PlanFields f) {
    Map<String, Object> p = new HashMap<>();
    p.put("title", f.title());
    p.put("date", f.date() == null ? null : Date.valueOf(f.date()));
    p.put("start", Time.valueOf(f.startTime()));
    p.put("district", f.district() == null ? null : f.district().name());
    p.put("note", f.note());
    p.put("status", f.status().name());
    p.put("memory", f.memory());
    p.put("vibe", f.vibe() == null ? null : f.vibe().name());
    p.put("budget", f.budget());
    p.put("rainy", f.rainy());
    return p;
  }

  private static Double toDouble(BigDecimal v) {
    return v == null ? null : v.doubleValue();
  }

  private static LocalTime toTime(Time t) {
    return t == null ? null : t.toLocalTime();
  }

  private static Instant toInstant(Timestamp t) {
    return t == null ? null : t.toInstant();
  }
}
