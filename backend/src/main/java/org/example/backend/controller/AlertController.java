package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.service.SlackWebhookService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final SlackWebhookService slackWebhookService;

    @PostMapping("/test")
    public String testSlack() {
        slackWebhookService.sendMessage("✅ 백엔드에서 보내는 Slack Webhook 테스트 메시지입니다.");
        return "Slack test message sent";
    }
}