package com.gfmaster.catalog;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Nhập "Khám phá quán" từ OpenStreetMap ({@code gfm.catalog.*}).
 *
 * @param overpassUrls máy chủ Overpass, thử lần lượt: máy chủ miễn phí hay quá tải (504)
 * @param requestTimeout thời gian chờ một truy vấn
 * @param delayBetweenCells nghỉ giữa hai ô (quận × loại), tôn trọng giới hạn của máy chủ miễn phí
 * @param retryDelay nghỉ trước khi thử máy chủ tiếp theo
 * @param staleAfter lượt nhập "đang chạy" quá lâu (app khởi động lại giữa chừng) thì coi là thất bại
 */
@Validated
@ConfigurationProperties("gfm.catalog")
public record CatalogProperties(
    @NotEmpty List<String> overpassUrls,
    @NotNull Duration requestTimeout,
    @NotNull Duration delayBetweenCells,
    @NotNull Duration retryDelay,
    @NotNull Duration staleAfter) {}
