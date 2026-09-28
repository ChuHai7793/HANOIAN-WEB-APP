package com.gfmaster.importer.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * Dữ liệu frontend cũ lưu trong localStorage ({@code gfm.places}, {@code gfm.girlfriends},
 * {@code gfm.placeLinks}). Kiểu dữ liệu để lỏng (String, số có thể null) vì dữ liệu cũ không qua
 * kiểm tra nào; LegacyImporter chuyển đổi và bỏ qua dòng hỏng thay vì từ chối cả file.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LegacyExport(List<Place> places, List<Girlfriend> girlfriends, List<PlaceLink> placeLinks) {

  public List<Place> placesOrEmpty() {
    return places == null ? List.of() : places;
  }

  public List<Girlfriend> girlfriendsOrEmpty() {
    return girlfriends == null ? List.of() : girlfriends;
  }

  public List<PlaceLink> placeLinksOrEmpty() {
    return placeLinks == null ? List.of() : placeLinks;
  }

  public int size() {
    return placesOrEmpty().size() + girlfriendsOrEmpty().size() + placeLinksOrEmpty().size();
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Place(
      String id,
      String type,
      String name,
      String address,
      String priceRange,
      Integer rating,
      String openTime,
      String closeTime,
      String imageUrl,
      String note,
      String googleMapsUrl,
      Double lat,
      Double lng,
      Boolean hasWifi,
      Boolean hasParking,
      String cuisine) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Girlfriend(
      String id,
      String name,
      String nickname,
      String avatarUrl,
      String birthday,
      String phone,
      String status,
      String startedDate,
      List<String> hobbies,
      String note) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record PlaceLink(
      String id, String girlfriendId, String placeId, Integer herRating, String lastVisitedAt, String memory) {}
}
