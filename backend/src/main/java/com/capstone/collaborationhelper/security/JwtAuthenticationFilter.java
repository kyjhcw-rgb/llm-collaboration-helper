package com.capstone.collaborationhelper.security;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Collections;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter{
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        
        //헤더에서 토큰 추출
        String header = request.getHeader("Authorization");
        String token = null;
        Integer userId = null;

        if (header != null && header.startsWith("Bearer ")) {
            token = header.substring(7);
            if (jwtTokenProvider.validateToken(token)) {
                try {
                    userId = jwtTokenProvider.getUserId(token);
                } catch (JwtException ignored) {
                    userId = null;
                }
            }
        }
        
        //토큰이 유효하고 인증되지 않은 상태일 때
        if (userId != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            //role 다루는 로직으로 추후에 추가필요
            UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList());

            //통과
            SecurityContextHolder.getContext().setAuthentication(authToken);
        }
        filterChain.doFilter(request, response);
    }
}