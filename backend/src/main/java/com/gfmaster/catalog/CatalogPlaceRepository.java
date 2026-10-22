package com.gfmaster.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface CatalogPlaceRepository
    extends JpaRepository<CatalogPlace, UUID>, JpaSpecificationExecutor<CatalogPlace> {

  boolean existsBySlug(String slug);

  Optional<CatalogPlace> findBySlug(String slug);

  /** Số quán theo khu vực (chỉ khu vực đang có quán): [district, count] */
  @Query("select p.district, count(p) from CatalogPlace p group by p.district")
  List<Object[]> countByDistrict();
}
