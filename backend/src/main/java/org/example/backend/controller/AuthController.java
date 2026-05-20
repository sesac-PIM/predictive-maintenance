package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.request.LoginRequest;
import org.example.backend.dto.request.SignupRequest;
import org.example.backend.dto.response.LoginResponse;
import org.example.backend.service.AuthService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public String signup(@RequestBody SignupRequest request) {
        authService.signup(request);
        return "Signup success";
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        return authService.login(request);
    }
}