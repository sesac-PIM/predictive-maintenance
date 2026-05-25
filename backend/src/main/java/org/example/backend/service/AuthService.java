package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.domain.user.RefreshToken;
import org.example.backend.domain.user.User;
import org.example.backend.dto.request.LoginRequest;
import org.example.backend.dto.request.RefreshTokenRequest;
import org.example.backend.dto.request.SignupRequest;
import org.example.backend.dto.response.LoginResponse;
import org.example.backend.global.exception.CustomException;
import org.example.backend.global.exception.ErrorCode;
import org.example.backend.repository.RefreshTokenRepository;
import org.example.backend.repository.UserRepository;
import org.example.backend.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    private static final int REFRESH_TOKEN_EXPIRE_DAYS = 14;

    @Transactional
    public void signup(SignupRequest request) {

        if (request.getUsername() == null || request.getUsername().isBlank()) {
            throw new CustomException(ErrorCode.BAD_REQUEST);
        }

        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new CustomException(ErrorCode.BAD_REQUEST);
        }

        if (request.getRole() == null) {
            throw new CustomException(ErrorCode.BAD_REQUEST);
        }

        if (userRepository.existsByUsername(request.getUsername())) {
            throw new CustomException(ErrorCode.DUPLICATE_USER);
        }

        User user = User.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .createdAt(LocalDateTime.now())
                .build();

        userRepository.save(user);
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {

        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_CREDENTIALS));

        if (!passwordEncoder.matches(
                request.getPassword(),
                user.getPassword()
        )) {
            throw new CustomException(ErrorCode.INVALID_CREDENTIALS);
        }

        String accessToken = jwtUtil.createToken(
                user.getUserId(),
                user.getUsername(),
                user.getRole()
        );
        String refreshToken = createRefreshToken(user);

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .build();
    }

    @Transactional
    public LoginResponse refresh(RefreshTokenRequest request) {
        if (request.getRefreshToken() == null || request.getRefreshToken().isBlank()) {
            throw new CustomException(ErrorCode.TOKEN_MISSING);
        }

        RefreshToken refreshToken = refreshTokenRepository
                .findByTokenAndRevokedFalse(request.getRefreshToken())
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_TOKEN));

        LocalDateTime now = LocalDateTime.now();
        if (refreshToken.isExpired(now)) {
            refreshToken.revoke();
            throw new CustomException(ErrorCode.TOKEN_EXPIRED);
        }

        User user = refreshToken.getUser();
        String accessToken = jwtUtil.createToken(
                user.getUserId(),
                user.getUsername(),
                user.getRole()
        );

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.getToken())
                .build();
    }

    private String createRefreshToken(User user) {
        String token = UUID.randomUUID().toString();
        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(token)
                .expiresAt(LocalDateTime.now().plusDays(REFRESH_TOKEN_EXPIRE_DAYS))
                .revoked(false)
                .createdAt(LocalDateTime.now())
                .build();
        refreshTokenRepository.save(refreshToken);
        return token;
    }
}
