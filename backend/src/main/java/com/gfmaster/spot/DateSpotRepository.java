package com.gfmaster.spot;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface DateSpotRepository extends JpaRepository<DateSpot, UUID>, JpaSpecificationExecutor<DateSpot> {

  boolean existsBySlug(String slug);

  Optional<DateSpot> findBySlug(String slug);
}
