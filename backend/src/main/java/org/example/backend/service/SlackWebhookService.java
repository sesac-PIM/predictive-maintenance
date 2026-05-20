package org.example.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class SlackWebhookService {

    private final RestTemplate restTemplate = new RestTemplate();

    public void sendMessage(String message) {
        String webhookUrl = System.getenv("SLACK_WEBHOOK_URL");

        System.out.println("SLACK_WEBHOOK_URL = " + webhookUrl);
        if (webhookUrl == null || webhookUrl.isBlank()) {
            throw new IllegalStateException("SLACK_WEBHOOK_URL 환경변수가 설정되지 않았습니다.");
        }

        Map<String, String> payload = Map.of("text", message);

        restTemplate.postForEntity(
                webhookUrl,
                payload,
                String.class
        );
    }
}