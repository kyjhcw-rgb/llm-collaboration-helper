package com.capstone.collaborationhelper.config;

import com.capstone.collaborationhelper.security.JwtAuthenticationFilter;
import com.capstone.collaborationhelper.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtTokenProvider jwtTokenProvider;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // 1. CSRF 비활성화 (JWT를 사용하므로 불필요)
                .csrf(AbstractHttpConfigurer::disable)

                // 2. CORS 설정 적용
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // 3. 세션 비활성화 (상태를 유지하지 않는 Stateless 설정)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // 4. API 권한 설정
                .authorizeHttpRequests(auth -> auth
                        // /api/auth/ 하위의 모든 주소(회원가입, 로그인, 이메일 인증)는 모두에게 허용! + Swagger 관련 주소
                        .requestMatchers(
                                "/api/auth/**",
                                "/error",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html"
                        ).permitAll()
                        // 그 외의 모든 요청은 로그인(토큰)이 필요함!
                        .anyRequest().authenticated()
                )

                // 5. JWT 필터 등록 (요청이 들어올 때마다 토큰이 맞는지 확인)
                .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // 비밀번호 암호화 도구
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // 프론트엔드(React)에서 백엔드(Spring)로 요청을 보낼 수 있도록 허용하는 CORS 설정
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // 프론트엔드 주소 허용 (Vite 5173, 혹은 수정하신 3000 포트)
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:5173", "http://localhost:3000"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}