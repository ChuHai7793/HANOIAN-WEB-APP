package com.gfmaster.vibe;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

/** Cột {@code vibes} (VARCHAR "chill,romantic") ↔ {@code Set<Vibe>}; cột {@code vibes_source} ↔ {@link VibeSource}. */
public final class VibeConverters {

  private VibeConverters() {}

  /** Luôn ghi theo thứ tự khai báo của {@link Vibe} để cùng một tập nhãn cho cùng một chuỗi. */
  public static String join(Set<Vibe> vibes) {
    return vibes == null ? "" : EnumSet.copyOf(withType(vibes)).stream().map(Vibe::name).collect(Collectors.joining(","));
  }

  public static Set<Vibe> split(String value) {
    EnumSet<Vibe> out = EnumSet.noneOf(Vibe.class);
    if (value == null || value.isBlank()) return out;
    Arrays.stream(value.split(",")).map(String::trim).map(Vibe::valueOf).forEach(out::add);
    return out;
  }

  private static Set<Vibe> withType(Set<Vibe> vibes) {
    return vibes.isEmpty() ? EnumSet.noneOf(Vibe.class) : vibes;
  }

  @Converter
  public static class VibesConverter implements AttributeConverter<Set<Vibe>, String> {
    @Override
    public String convertToDatabaseColumn(Set<Vibe> vibes) {
      return join(vibes);
    }

    @Override
    public Set<Vibe> convertToEntityAttribute(String value) {
      return split(value);
    }
  }

  @Converter
  public static class SourceConverter implements AttributeConverter<VibeSource, String> {
    @Override
    public String convertToDatabaseColumn(VibeSource source) {
      return (source == null ? VibeSource.DEFAULT : source).code();
    }

    @Override
    public VibeSource convertToEntityAttribute(String value) {
      return VibeSource.of(value);
    }
  }
}
