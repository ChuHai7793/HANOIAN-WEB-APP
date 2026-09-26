package com.gfmaster.girlfriend;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.web.Patch;
import com.gfmaster.girlfriend.dto.GirlfriendPatch;
import com.gfmaster.girlfriend.dto.GirlfriendRequest;
import com.gfmaster.girlfriend.dto.GirlfriendResponse;
import com.gfmaster.placelink.PlaceLinkRepository;
import com.gfmaster.placelink.PlaceLinkRepository.GirlfriendLinkCount;
import com.gfmaster.user.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class GirlfriendService {

  private final GirlfriendRepository girlfriends;
  private final PlaceLinkRepository links;
  private final UserRepository users;
  private final GirlfriendMapper mapper;

  public GirlfriendService(
      GirlfriendRepository girlfriends,
      PlaceLinkRepository links,
      UserRepository users,
      GirlfriendMapper mapper) {
    this.girlfriends = girlfriends;
    this.links = links;
    this.users = users;
    this.mapper = mapper;
  }

  /** Danh sách kèm placeCount, tính bằng một query group by (thay cho {@code countFor()}). */
  @Transactional(readOnly = true)
  public List<GirlfriendResponse> list(UUID userId) {
    Map<UUID, Long> counts =
        links.countPerGirlfriend(userId).stream()
            .collect(Collectors.toMap(GirlfriendLinkCount::getGirlfriendId, GirlfriendLinkCount::getTotal));
    return girlfriends.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
        .map(gf -> mapper.toResponse(gf, counts.getOrDefault(gf.getId(), 0L)))
        .toList();
  }

  @Transactional(readOnly = true)
  public GirlfriendResponse get(UUID userId, UUID id) {
    return toResponse(load(userId, id));
  }

  public GirlfriendResponse create(UUID userId, GirlfriendRequest request) {
    Girlfriend gf = mapper.toEntity(request);
    gf.setUser(users.getReferenceById(userId));
    return mapper.toResponse(girlfriends.saveAndFlush(gf), 0);
  }

  public GirlfriendResponse update(UUID userId, UUID id, Patch<GirlfriendPatch> patch) {
    Girlfriend gf = load(userId, id);
    if (!Objects.equals(gf.getVersion(), patch.value().version())) {
      throw new ApiException(ErrorCode.VERSION_CONFLICT).with("current", toResponse(gf));
    }
    mapper.apply(patch, gf);
    return toResponse(girlfriends.saveAndFlush(gf));
  }

  public void delete(UUID userId, UUID id) {
    // place_links và girlfriend_hobbies bị DB xoá theo (ON DELETE CASCADE)
    if (girlfriends.deleteByIdAndUserId(id, userId) == 0) {
      throw ApiException.notFound();
    }
  }

  private Girlfriend load(UUID userId, UUID id) {
    return girlfriends.findByIdAndUserId(id, userId).orElseThrow(ApiException::notFound);
  }

  private GirlfriendResponse toResponse(Girlfriend gf) {
    return mapper.toResponse(gf, links.countByGirlfriendId(gf.getId()));
  }
}
