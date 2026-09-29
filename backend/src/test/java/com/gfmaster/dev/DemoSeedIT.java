package com.gfmaster.dev;

import static org.assertj.core.api.Assertions.assertThat;

import com.gfmaster.support.IntegrationTest;
import com.gfmaster.upload.ImageProcessor;
import com.gfmaster.upload.storage.StorageDriver;
import com.sksamuel.scrimage.ImmutableImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;

/**
 * Dữ liệu mẫu của profile dev: chạy thẳng R__demo_data.sql trên MariaDB của test (không cần bật app
 * dev) và kiểm tra mọi ảnh mà seed trỏ tới đều có trong {@code seed-assets/}.
 */
@IntegrationTest
class DemoSeedIT {

  private static final Path ASSETS = Path.of("seed-assets");
  private static final String DEMO = "(select id from users where username = 'admin')";

  @Autowired DataSource dataSource;
  @Autowired JdbcTemplate jdbc;
  @Autowired StorageDriver storage;
  @Autowired ImageProcessor processor;

  @Test
  void seedScriptLoadsHanoiPlacesAndLinks() throws Exception {
    runSeed();

    assertThat(countPlaces("")).isEqualTo(16);
    assertThat(countPlaces("and type = 'cafe'")).isEqualTo(10);
    assertThat(countPlaces("and type = 'bar'")).isEqualTo(1);
    assertThat(countPlaces("and type = 'restaurant'")).isEqualTo(5);
    // Toạ độ (nếu có) nằm trong Hà Nội
    assertThat(countPlaces("and lat is not null and (lat not between 20.9 and 21.1 or lng not between 105.7 and 105.9)"))
        .isZero();
    assertThat(count("select count(*) from girlfriends where user_id = " + DEMO)).isEqualTo(2);
    assertThat(count("select count(*) from place_links l join girlfriends g on g.id = l.girlfriend_id where g.user_id = " + DEMO))
        .isEqualTo(4);

    // Chạy lại lần nữa vẫn ra đúng số đó (script idempotent)
    runSeed();
    assertThat(countPlaces("")).isEqualTo(16);
  }

  @Test
  void everySeedImageHasASourceFileAndIsLoaded() throws Exception {
    runSeed();
    List<String> urls = jdbc.queryForList("select image_url from places where user_id = " + DEMO, String.class);
    Set<String> expectedKeys = urls.stream().map(u -> u.replaceFirst("^/uploads/", "")).collect(Collectors.toSet());

    Set<String> available;
    try (Stream<Path> files = Files.walk(ASSETS)) {
      available =
          files
              .filter(Files::isRegularFile)
              .filter(f -> !f.toString().endsWith(".md"))
              .map(SeedAssetLoader::keyOf)
              .collect(Collectors.toSet());
    }
    assertThat(available).containsAll(expectedKeys);

    new SeedAssetLoader(storage, processor, ASSETS).run(null);

    for (String key : expectedKeys) {
      assertThat(storage.exists(key)).as(key).isTrue();
      ImmutableImage image = ImmutableImage.loader().fromBytes(storage.get(key));
      assertThat(Math.max(image.width, image.height)).as(key).isLessThanOrEqualTo(1200);
    }
  }

  private void runSeed() throws SQLException {
    try (Connection connection = dataSource.getConnection()) {
      ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/seed/R__demo_data.sql"));
    }
  }

  private int countPlaces(String condition) {
    return count("select count(*) from places where user_id = " + DEMO + " " + condition);
  }

  private int count(String sql) {
    return jdbc.queryForObject(sql, Integer.class);
  }
}
