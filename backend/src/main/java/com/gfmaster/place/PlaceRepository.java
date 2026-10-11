package com.gfmaster.place;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** Mọi truy vấn đều kèm {@code userId} để chống IDOR. */
public interface PlaceRepository extends JpaRepository<Place, UUID> {

  List<Place> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

  List<Place> findAllByUserIdAndTypeOrderByCreatedAtDesc(UUID userId, PlaceType type);

  Optional<Place> findByIdAndUserId(UUID id, UUID userId);

  /** Trong các quán của danh mục {@code catalogIds}, những quán đã có trong My place của {@code userId}. */
  @Query("select p.catalogId from Place p where p.user.id = :userId and p.catalogId in :catalogIds")
  List<UUID> findCatalogIdsInMyPlace(UUID userId, Collection<UUID> catalogIds);

  boolean existsByUserIdAndCatalogId(UUID userId, UUID catalogId);

  /** Mọi bản sao (của mọi người) của một quán trong danh mục. */
  List<Place> findAllByCatalogId(UUID catalogId);

  long deleteByIdAndUserId(UUID id, UUID userId);

  @Query("select p.type as type, count(p) as total from Place p where p.user.id = :userId group by p.type")
  List<TypeCount> countByType(UUID userId);

  interface TypeCount {
    PlaceType getType();

    long getTotal();
  }
}
