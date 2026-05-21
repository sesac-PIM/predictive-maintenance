package org.example.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class SlackWebhookService {

    private static final Logger log = LoggerFactory.getLogger(SlackWebhookService.class);
    private final RestTemplate restTemplate = new RestTemplate();

    public void sendMessage(String message) {
        String webhookUrl = System.getenv("SLACK_WEBHOOK_URL");

        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.warn("SLACK_WEBHOOK_URL is not set. Skip Slack webhook send.");
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
