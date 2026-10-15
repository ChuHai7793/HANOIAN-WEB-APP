package com.gfmaster.catalog;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CatalogPlaceRepository
    extends JpaRepository<CatalogPlace, UUID>, JpaSpecificationExecutor<CatalogPlace> {

  boolean existsBySlug(String slug);

  Optional<CatalogPlace> findBySlug(String slug);
}
