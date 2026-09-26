package com.gfmaster.place;

import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.common.web.PatchReader;
import com.gfmaster.place.dto.PlacePatch;
import com.gfmaster.place.dto.PlaceRequest;
import com.gfmaster.place.dto.PlaceResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/v1/places")
public class PlaceController {

  private final PlaceService service;
  private final PatchReader patchReader;

  public PlaceController(PlaceService service, PatchReader patchReader) {
    this.service = service;
    this.patchReader = patchReader;
  }

  @GetMapping
  public List<PlaceResponse> list(
      @CurrentUser UUID userId, @RequestParam(required = false) PlaceType type) {
    return service.list(userId, type);
  }

  @GetMapping("/{id}")
  public PlaceResponse get(@CurrentUser UUID userId, @PathVariable UUID id) {
    return service.get(userId, id);
  }

  @PostMapping
  public ResponseEntity<PlaceResponse> create(
      @CurrentUser UUID userId, @Valid @RequestBody PlaceRequest request) {
    PlaceResponse created = service.create(userId, request);
    return ResponseEntity.created(URI.create("/api/v1/places/" + created.id())).body(created);
  }

  @PatchMapping("/{id}")
  public PlaceResponse update(
      @CurrentUser UUID userId, @PathVariable UUID id, @RequestBody JsonNode body) {
    return service.update(userId, id, patchReader.read(body, PlacePatch.class));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@CurrentUser UUID userId, @PathVariable UUID id) {
    service.delete(userId, id);
    return ResponseEntity.noContent().build();
  }
}
