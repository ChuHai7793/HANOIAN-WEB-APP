package com.gfmaster.catalog;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface CatalogPlaceRepository
    extends JpaRepository<CatalogPlace, UUID>, JpaSpecificationExecutor<CatalogPlace> {

  List<CatalogPlace> findBySourceAndExternalIdIn(String source, Collection<String> externalIds);

  @Query("select max(c.fetchedAt) from CatalogPlace c")
  Instant lastFetchedAt();
}
