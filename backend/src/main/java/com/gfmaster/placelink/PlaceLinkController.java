package com.gfmaster.placelink;

import com.gfmaster.common.security.DataOwner;
import com.gfmaster.common.web.PatchReader;
import com.gfmaster.placelink.dto.PlaceLinkPatch;
import com.gfmaster.placelink.dto.PlaceLinkRequest;
import com.gfmaster.placelink.dto.PlaceLinkResponse;
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
@RequestMapping("/api/v1/place-links")
public class PlaceLinkController {

  private final PlaceLinkService service;
  private final PatchReader patchReader;

  public PlaceLinkController(PlaceLinkService service, PatchReader patchReader) {
    this.service = service;
    this.patchReader = patchReader;
  }

  @GetMapping
  public List<PlaceLinkResponse> list(
      @DataOwner UUID userId,
      @RequestParam(required = false) UUID girlfriendId,
      @RequestParam(required = false) UUID placeId) {
    return service.list(userId, girlfriendId, placeId);
  }

  @PostMapping
  public ResponseEntity<PlaceLinkResponse> create(
      @DataOwner UUID userId, @Valid @RequestBody PlaceLinkRequest request) {
    PlaceLinkResponse created = service.create(userId, request);
    return ResponseEntity.created(URI.create("/api/v1/place-links/" + created.id())).body(created);
  }

  @PatchMapping("/{id}")
  public PlaceLinkResponse update(
      @DataOwner UUID userId, @PathVariable UUID id, @RequestBody JsonNode body) {
    return service.update(userId, id, patchReader.read(body, PlaceLinkPatch.class));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@DataOwner UUID userId, @PathVariable UUID id) {
    service.delete(userId, id);
    return ResponseEntity.noContent().build();
  }
}
