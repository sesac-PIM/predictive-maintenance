package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.service.RealtimeEventService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class RealtimeEventController {

    private final RealtimeEventService realtimeEventService;

    @GetMapping("/stream")
    public SseEmitter stream() {
        return realtimeEventService.subscribe();
    }
}
