package com.capstone.collaborationhelper.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI openAPI() {
        String jwtSchemeName = "JWT_TOKEN";

        // API 요청 헤더에 토큰을 포함시키기 위한 설정
        SecurityRequirement securityRequirement = new SecurityRequirement().addList(jwtSchemeName);

        Components components = new Components()
                .addSecuritySchemes(jwtSchemeName, new SecurityScheme()
                        .name(jwtSchemeName)
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT"));

        return new OpenAPI()
                .info(new Info().title("Our Diagram API 명세서")
                        .description("이메일 인증 기반 회원가입 및 프로젝트 관리 API")
                        .version("1.0.0"))
                .addSecurityItem(securityRequirement)
                .components(components);
    }
}