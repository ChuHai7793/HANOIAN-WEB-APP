package com.gfmaster.girlfriend;

import com.gfmaster.common.security.DataOwner;
import com.gfmaster.common.web.PatchReader;
import com.gfmaster.girlfriend.dto.GirlfriendPatch;
import com.gfmaster.girlfriend.dto.GirlfriendRequest;
import com.gfmaster.girlfriend.dto.GirlfriendResponse;
import com.gfmaster.place.PlaceType;
import com.gfmaster.placelink.PlaceLinkService;
import com.gfmaster.placelink.dto.LinkedPlaceResponse;
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
@RequestMapping("/api/v1/girlfriends")
public class GirlfriendController {

  private final GirlfriendService service;
  private final PlaceLinkService linkService;
  private final PatchReader patchReader;

  public GirlfriendController(
      GirlfriendService service, PlaceLinkService linkService, PatchReader patchReader) {
    this.service = service;
    this.linkService = linkService;
    this.patchReader = patchReader;
  }

  @GetMapping
  public List<GirlfriendResponse> list(@DataOwner UUID userId) {
    return service.list(userId);
  }

  @GetMapping("/{id}")
  public GirlfriendResponse get(@DataOwner UUID userId, @PathVariable UUID id) {
    return service.get(userId, id);
  }

  @GetMapping("/{id}/links")
  public List<LinkedPlaceResponse> links(
      @DataOwner UUID userId,
      @PathVariable UUID id,
      @RequestParam(required = false) PlaceType type) {
    return linkService.linkedPlaces(userId, id, type);
  }

  @PostMapping
  public ResponseEntity<GirlfriendResponse> create(
      @DataOwner UUID userId, @Valid @RequestBody GirlfriendRequest request) {
    GirlfriendResponse created = service.create(userId, request);
    return ResponseEntity.created(URI.create("/api/v1/girlfriends/" + created.id())).body(created);
  }

  @PatchMapping("/{id}")
  public GirlfriendResponse update(
      @DataOwner UUID userId, @PathVariable UUID id, @RequestBody JsonNode body) {
    return service.update(userId, id, patchReader.read(body, GirlfriendPatch.class));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@DataOwner UUID userId, @PathVariable UUID id) {
    service.delete(userId, id);
    return ResponseEntity.noContent().build();
  }
}
