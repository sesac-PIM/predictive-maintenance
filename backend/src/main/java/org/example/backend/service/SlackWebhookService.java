package org.example.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class SlackWebhookService {

    private final RestTemplate restTemplate = new RestTemplate();

    public void sendMessage(String message) {
        String webhookUrl = System.getenv("SLACK_WEBHOOK_URL");

        if (webhookUrl == null || webhookUrl.isBlank()) {
            System.out.println("[WARN] SLACK_WEBHOOK_URL is not set. Skipping Slack webhook send.");
            return;
        }

        Map<String, String> payload = Map.of("text", message);

        restTemplate.postForEntity(
                webhookUrl,
                payload,
                String.class
        );
    }
}
