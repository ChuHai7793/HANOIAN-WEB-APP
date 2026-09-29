package com.gfmaster.girlfriend;

import com.gfmaster.common.web.MapperConfigDefaults;
import com.gfmaster.common.web.Patch;
import com.gfmaster.girlfriend.dto.GirlfriendPatch;
import com.gfmaster.girlfriend.dto.GirlfriendRequest;
import com.gfmaster.girlfriend.dto.GirlfriendResponse;
import com.gfmaster.upload.storage.ImageUrls;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(config = MapperConfigDefaults.class, uses = ImageUrls.class)
public interface GirlfriendMapper {

  @Mapping(target = "avatarUrl", source = "girlfriend.avatarUrl", qualifiedByName = "publicUrl")
  GirlfriendResponse toResponse(Girlfriend girlfriend, long placeCount);

  @Mapping(target = "id", ignore = true)
  @Mapping(target = "user", ignore = true)
  @Mapping(target = "version", ignore = true)
  @Mapping(target = "createdAt", ignore = true)
  @Mapping(target = "updatedAt", ignore = true)
  @Mapping(target = "nickname", defaultValue = "")
  @Mapping(target = "avatarUrl", defaultValue = "")
  @Mapping(target = "phone", defaultValue = "")
  @Mapping(target = "status", defaultValue = "dating")
  @Mapping(target = "note", defaultValue = "")
  Girlfriend toEntity(GirlfriendRequest request);

  /** Áp PATCH: ngày sinh / ngày quen gửi null thì xoá; hobbies gửi lên thay toàn bộ danh sách. */
  default void apply(Patch<GirlfriendPatch> patch, Girlfriend gf) {
    GirlfriendPatch p = patch.value();
    patch
        .set("name", p.name(), gf::setName)
        .set("nickname", p.nickname(), gf::setNickname)
        .set("avatarUrl", p.avatarUrl(), gf::setAvatarUrl)
        .setNullable("birthday", p.birthday(), gf::setBirthday)
        .set("phone", p.phone(), gf::setPhone)
        .set("status", p.status(), gf::setStatus)
        .setNullable("startedDate", p.startedDate(), gf::setStartedDate)
        .set("note", p.note(), gf::setNote)
        .set("hobbies", p.hobbies(), (List<String> list) -> replaceHobbies(gf, list));
  }

  private static void replaceHobbies(Girlfriend gf, List<String> hobbies) {
    // Giữ nguyên instance collection mà Hibernate đang theo dõi
    gf.getHobbies().clear();
    gf.getHobbies().addAll(hobbies.stream().map(String::trim).toList());
  }
}
