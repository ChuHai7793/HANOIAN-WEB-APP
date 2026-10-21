package com.gfmaster.user;

import com.gfmaster.auth.social.SocialProvider;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, UUID> {

  Optional<UserIdentity> findByProviderAndSubject(SocialProvider provider, String subject);
}
