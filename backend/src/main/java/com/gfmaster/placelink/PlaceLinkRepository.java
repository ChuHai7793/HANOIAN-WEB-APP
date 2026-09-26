package com.gfmaster.placelink;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlaceLinkRepository extends JpaRepository<PlaceLink, UUID> {

  @EntityGraph(attributePaths = "place")
  List<PlaceLink> findAllByGirlfriendUserId(UUID userId);

  @EntityGraph(attributePaths = "place")
  List<PlaceLink> findAllByGirlfriendIdAndGirlfriendUserId(UUID girlfriendId, UUID userId);

  @EntityGraph(attributePaths = "place")
  Optional<PlaceLink> findByIdAndGirlfriendUserId(UUID id, UUID userId);

  long deleteByIdAndGirlfriendUserId(UUID id, UUID userId);
}
