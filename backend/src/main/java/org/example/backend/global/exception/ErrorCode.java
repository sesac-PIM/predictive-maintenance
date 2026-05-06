package org.example.backend.global.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {

    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 일치하지 않습니다."),
    TOKEN_MISSING(HttpStatus.UNAUTHORIZED, "TOKEN_MISSING", "인증 토큰이 필요합니다."),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "INVALID_TOKEN", "유효하지 않은 토큰입니다."),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "TOKEN_EXPIRED", "만료된 토큰입니다."),
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "접근 권한이 없습니다."),

    DUPLICATE_USER(HttpStatus.CONFLICT, "DUPLICATE_USER", "이미 존재하는 사용자입니다."),

    BAD_REQUEST(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "잘못된 요청입니다."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "NOT_FOUND", "요청한 리소스를 찾을 수 없습니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", "서버 오류");

    private final HttpStatus status;
    private final String code;
    private final String message;

    ErrorCode(HttpStatus status, String code, String message) {
        this.status = status;
        this.code = code;
        this.message = message;
    }
}