package com.gfmaster.catalog;

import com.gfmaster.catalog.CatalogImportRun.Status;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CatalogImportRunRepository extends JpaRepository<CatalogImportRun, UUID> {

  List<CatalogImportRun> findTop10ByOrderByStartedAtDesc();

  List<CatalogImportRun> findByStatus(Status status);
}
