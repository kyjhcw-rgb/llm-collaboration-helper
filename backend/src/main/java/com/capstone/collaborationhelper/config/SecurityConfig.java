package com.capstone.collaborationhelper.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        // Swagger와 Health Check만 허용
                        .requestMatchers("/api/health", "/swagger-ui/**", "/v3/api-docs/**", "/api-docs/**").permitAll()
                        // 그 외 모든 요청은 로그인 필요
                        .anyRequest().authenticated()
                );
        return http.build();
    }
}