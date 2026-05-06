package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.domain.user.User;
import org.example.backend.dto.request.LoginRequest;
import org.example.backend.dto.request.SignupRequest;
import org.example.backend.dto.response.LoginResponse;
import org.example.backend.global.exception.CustomException;
import org.example.backend.global.exception.ErrorCode;
import org.example.backend.repository.UserRepository;
import org.example.backend.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

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

        return LoginResponse.builder()
                .accessToken(accessToken)
                .build();
    }
}