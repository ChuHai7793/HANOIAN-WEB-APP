package com.gfmaster.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

import com.gfmaster.support.ApiTestSupport;
import java.sql.Connection;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;

/**
 * V8: quán có sẵn trong places (chưa thuộc danh mục) được đưa vào "Khám phá quán". Chạy lại script V8
 * trên dữ liệu tự tạo: gộp quán trùng, đoán khu vực theo địa chỉ rồi toạ độ, nối places.catalog_id.
 */
class CatalogBackfillIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;
  @Autowired DataSource dataSource;

  @Test
  void existingPlacesAreCopiedIntoCatalogAndLinked() throws Exception {
    UUID a = newUser();
    UUID b = newUser();
    // Cùng một quán ở My place của hai người (khác hoa thường) → một mục danh mục, nối cả hai
    String same = place(a, "Cafe Trùng", "12 Phố Huế, Hai Bà Trưng", null, null);
    String sameOther = place(b, "cafe trùng", "12 phố huế, hai bà trưng", null, null);
    // Không có tên quận trong địa chỉ → đoán theo toạ độ (Cầu Giấy)
    String byCoords = place(a, "Cafe Toạ Độ", "45 Nguyen Khang", 21.03, 105.79);
    // Không đoán được gì → Hoàn Kiếm
    String unknown = place(a, "Cafe Bí Ẩn", "", null, null);
    // Địa chỉ không dấu vẫn nhận ra quận
    String noAccent = place(b, "Bia Hoi", "1 Ta Hien, Hoan Kiem", null, null);

    try (Connection c = dataSource.getConnection()) {
      ScriptUtils.executeSqlScript(c, new ClassPathResource("db/migration/V8__catalog_contains_every_place.sql"));
    }

    assertThat(catalogOf(same)).isNotNull().isEqualTo(catalogOf(sameOther));
    assertThat(districtOf(same)).isEqualTo("HAI_BA_TRUNG");
    assertThat(districtOf(byCoords)).isEqualTo("CAU_GIAY");
    assertThat(districtOf(unknown)).isEqualTo("HOAN_KIEM");
    assertThat(districtOf(noAccent)).isEqualTo("HOAN_KIEM");
    assertThat(jdbc.queryForObject("select count(*) from place_catalog where lower(name) = 'cafe trùng'", Long.class))
        .isEqualTo(1);
    // Khám phá quán đánh dấu đã có trong My place
    getAs(a, "/api/v1/catalog?q=trùng").andExpect(jsonPath("$.items[0].inMyPlace").value(true));
  }

  private String place(UUID user, String name, String address, Double lat, Double lng) {
    UUID id = UUID.randomUUID();
    jdbc.update(
        """
        insert into places (id, user_id, type, name, address, price_range, rating, open_time, close_time,
                            lat, lng, created_at, updated_at, version)
        values (?, ?, 'cafe', ?, ?, 'medium', 4, '08:00', '22:00', ?, ?, now(), now(), 0)
        """,
        id, user, name, address, lat, lng);
    return id.toString();
  }

  private String catalogOf(String placeId) {
    return jdbc.queryForObject("select catalog_id::text from places where id = ?::uuid", String.class, placeId);
  }

  private String districtOf(String placeId) {
    return jdbc.queryForObject(
        "select c.district from place_catalog c join places p on p.catalog_id = c.id where p.id = ?::uuid",
        String.class,
        placeId);
  }
}
