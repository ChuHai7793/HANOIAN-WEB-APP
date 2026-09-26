package com.gfmaster;

import org.springframework.boot.SpringApplication;

public class TestGfMasterApplication {

	public static void main(String[] args) {
		SpringApplication.from(GfMasterApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
