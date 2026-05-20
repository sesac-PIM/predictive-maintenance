package org.example.backend.security;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.example.backend.global.exception.ErrorCode;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String authorizationHeader =
                request.getHeader("Authorization");

        // 토큰 없음
        if (authorizationHeader == null ||
                !authorizationHeader.startsWith("Bearer ")) {

            filterChain.doFilter(request, response);
            return;
        }

        String token = authorizationHeader.substring(7);

        try {

            // 토큰 검증
            jwtUtil.extractClaims(token);

            String username = jwtUtil.extractUsername(token);
            String role = jwtUtil.extractRole(token);

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            username,
                            null,
                            List.of(new SimpleGrantedAuthority(role))
                    );

            SecurityContextHolder.getContext()
                    .setAuthentication(authentication);

        }

        // 만료된 토큰
        catch (ExpiredJwtException e) {

            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");

            response.getWriter().write(
                    "{\"code\":\""
                            + ErrorCode.TOKEN_EXPIRED.getCode()
                            + "\",\"message\":\""
                            + ErrorCode.TOKEN_EXPIRED.getMessage()
                            + "\"}"
            );

            return;
        }

        // 잘못된 토큰
        catch (JwtException | IllegalArgumentException e) {

            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");

            response.getWriter().write(
                    "{\"code\":\""
                            + ErrorCode.INVALID_TOKEN.getCode()
                            + "\",\"message\":\""
                            + ErrorCode.INVALID_TOKEN.getMessage()
                            + "\"}"
            );

            return;
        }

        filterChain.doFilter(request, response);
    }
}