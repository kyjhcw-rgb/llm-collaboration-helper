package com.capstone.collaborationhelper.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtTokenProvider {
    @Value("${jwt.secret}")
    private String salt;

    @Value("${jwt.expiration}")
    private long validityInMilliseconds;
    private SecretKey secretKey;

    @PostConstruct
    protected void init() {
        this.secretKey = Keys.hmacShaKeyFor(salt.getBytes(StandardCharsets.UTF_8));
    }

    public String createToken(Integer userId) {
        Claims claims = Jwts.claims().subject(String.valueOf(userId)).build();
        Date now = new Date();
        Date validity = new Date(now.getTime() + validityInMilliseconds);

        return Jwts.builder()
                .claims(claims)
                .issuedAt(now)
                .expiration(validity)
                .signWith(secretKey)
                .compact();
    }

    public Integer getUserId(String token) {
        String subject = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
        if (subject == null || subject.isBlank()) {
            throw new JwtException("Token subject is missing");
        }
        try {
            return Integer.valueOf(subject.trim());
        } catch (NumberFormatException e) {
            throw new JwtException("Token subject is not a valid user id", e);
        }
    }

    public boolean validateToken(String token) {
        try {
            Jws<Claims> claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token);
                return !claims.getPayload().getExpiration().before(new Date());
        }catch(JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
