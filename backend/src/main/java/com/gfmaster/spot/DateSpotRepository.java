package com.gfmaster.spot;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface DateSpotRepository extends JpaRepository<DateSpot, UUID>, JpaSpecificationExecutor<DateSpot> {}
