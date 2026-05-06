package org.example.backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.example.backend.global.enums.Role;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtUtil {

    private static final String SECRET_KEY =
            "mySecretKeymySecretKeymySecretKeymySecretKey";

    private static final long ACCESS_TOKEN_EXPIRE_TIME = 1000 * 60 * 60;

    private final SecretKey key =
            Keys.hmacShaKeyFor(SECRET_KEY.getBytes());

    public String createToken(Long userId, String username, Role role) {

        Date now = new Date();
        Date expiration = new Date(
                now.getTime() + ACCESS_TOKEN_EXPIRE_TIME
        );

        return Jwts.builder()
                .setSubject(username)
                .claim("userId", userId)
                .claim("role", role.name())
                .setIssuedAt(now)
                .setExpiration(expiration)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Claims extractClaims(String token) {

        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public boolean validateToken(String token) {

        try {
            extractClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String extractUsername(String token) {
        return extractClaims(token).getSubject();
    }

    public String extractRole(String token) {
        return extractClaims(token)
                .get("role", String.class);
    }
}