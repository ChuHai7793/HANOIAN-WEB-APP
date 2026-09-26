package com.gfmaster;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class GfMasterApplication {

  public static void main(String[] args) {
    SpringApplication.run(GfMasterApplication.class, args);
  }
}
