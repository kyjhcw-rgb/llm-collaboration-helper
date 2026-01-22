package com.capstone.collaborationhelper.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("팀 프로젝트 협업 도우미 API")
                        .description("LLM 기반 협업 도우미 서비스의 백엔드 API 명세서")
                        .version("v1.0.0"));
    }
}