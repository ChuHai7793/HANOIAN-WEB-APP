package com.gfmaster.placelink;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** Link không có user_id riêng: quyền sở hữu lấy qua {@code girlfriend.user}. */
public interface PlaceLinkRepository extends JpaRepository<PlaceLink, UUID> {

  @EntityGraph(attributePaths = "place")
  List<PlaceLink> findAllByGirlfriendUserIdOrderByCreatedAtDesc(UUID userId);

  @EntityGraph(attributePaths = "place")
  List<PlaceLink> findAllByGirlfriendIdAndGirlfriendUserId(UUID girlfriendId, UUID userId);

  @EntityGraph(attributePaths = "place")
  List<PlaceLink> findAllByPlaceIdAndGirlfriendUserId(UUID placeId, UUID userId);

  @EntityGraph(attributePaths = "place")
  Optional<PlaceLink> findByIdAndGirlfriendUserId(UUID id, UUID userId);

  long deleteByIdAndGirlfriendUserId(UUID id, UUID userId);

  long countByGirlfriendId(UUID girlfriendId);

  @Query(
      """
      select l.girlfriend.id as girlfriendId, count(l) as total
      from PlaceLink l
      where l.girlfriend.user.id = :userId
      group by l.girlfriend.id
      """)
  List<GirlfriendLinkCount> countPerGirlfriend(UUID userId);

  interface GirlfriendLinkCount {
    UUID getGirlfriendId();

    long getTotal();
  }
}
