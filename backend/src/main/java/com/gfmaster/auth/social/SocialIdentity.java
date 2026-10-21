package com.gfmaster.auth.social;

/**
 * Danh tính đã được nhà cung cấp xác minh. {@code subject}: id cố định (Google {@code sub}, Facebook user id);
 * {@code email} luôn có và đã được nhà cung cấp xác minh; {@code name}, {@code pictureUrl} có thể null.
 */
public record SocialIdentity(SocialProvider provider, String subject, String email, String name, String pictureUrl) {}
