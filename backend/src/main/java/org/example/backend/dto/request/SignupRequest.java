package org.example.backend.dto.request;

import lombok.Getter;
import org.example.backend.global.enums.Role;

@Getter
public class SignupRequest {

    private String username;
    private String password;
    private Role role;
}