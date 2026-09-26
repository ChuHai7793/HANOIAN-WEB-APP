package com.gfmaster.common.web;

import org.mapstruct.MapperConfig;
import org.mapstruct.ReportingPolicy;

/**
 * Cấu hình chung cho mọi mapper MapStruct. Field đích chưa được map sẽ gây lỗi compile, để không
 * quên field khi schema đổi.
 */
@MapperConfig(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface MapperConfigDefaults {}
