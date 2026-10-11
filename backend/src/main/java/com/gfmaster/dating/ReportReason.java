package com.gfmaster.dating;

/** Lý do báo cáo một người trong "Tìm đối tượng". Giữ chữ thường (khớp CHECK trong DB). */
public enum ReportReason {
  fake_profile,
  inappropriate,
  harassment,
  spam,
  underage,
  other
}
