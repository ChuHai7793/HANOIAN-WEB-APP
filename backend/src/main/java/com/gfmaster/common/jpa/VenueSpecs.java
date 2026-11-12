package com.gfmaster.common.jpa;

import com.gfmaster.vibe.Vibe;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;

/**
 * Điều kiện lọc dùng chung cho quán (CatalogPlace) và chỗ chơi (DateSpot): tìm theo từ khoá, lọc theo kiểu hẹn.
 * Hai entity có cùng tên field {@code name}, {@code address}, {@code vibesText}.
 */
public final class VenueSpecs {

  /** Hàm SQL trong V35: bỏ dấu, dùng được index trigram. */
  static final String UNACCENT = "immutable_unaccent";

  private VenueSpecs() {}

  /**
   * Từ khoá khớp tên hoặc địa chỉ, không phân biệt hoa thường và dấu ("cuoi ngo" ra "Cuối Ngõ"). Từ khoá trống thì
   * không lọc. {@code %}, {@code _} trong từ khoá được coi là ký tự thường.
   */
  public static <T> Specification<T> search(String q) {
    if (q == null || q.isBlank()) return Specification.unrestricted();
    String like = "%" + normalize(q).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    return (root, query, cb) ->
        cb.or(cb.like(unaccented(cb, root, "name"), like, '\\'), cb.like(unaccented(cb, root, "address"), like, '\\'));
  }

  /** Khớp ít nhất một kiểu hẹn (cột vibes dạng chuỗi "chill,romantic"). Tập rỗng thì không lọc. */
  public static <T> Specification<T> anyVibe(Set<Vibe> vibes) {
    if (vibes == null || vibes.isEmpty()) return Specification.unrestricted();
    return (root, query, cb) ->
        cb.or(vibes.stream().map(v -> cb.like(root.get("vibesText"), "%" + v.name() + "%")).toArray(Predicate[]::new));
  }

  /** Cùng phép biến đổi với index: {@code immutable_unaccent(lower(cột))}. */
  private static <T> Expression<String> unaccented(CriteriaBuilder cb, Root<T> root, String field) {
    return cb.function(UNACCENT, String.class, cb.lower(root.get(field)));
  }

  /** Chữ thường, bỏ dấu, đ → d; cùng kết quả với {@code unaccent(lower(...))} trong Postgres. */
  public static String normalize(String s) {
    String t = s.trim().toLowerCase(Locale.ROOT).replace('đ', 'd');
    return Normalizer.normalize(t, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
  }
}
