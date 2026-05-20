package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.response.AlertResponse;
import org.example.backend.service.AlertService;
import org.example.backend.repository.AlertHistoryRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;
    private final AlertHistoryRepository alertHistoryRepository;

    // -------------------------
    // 1. Slack 알림 전송 (모터)
    // -------------------------
    @PostMapping("/motor/{anomalyResultId}/send")
    public String sendMotorAlert(@PathVariable Long anomalyResultId) {
        alertService.sendMotorAlert(anomalyResultId);
        return "Motor alert sent";
    }

    // -------------------------
    // 2. Slack 알림 전송 (튜브)
    // -------------------------
    @PostMapping("/tube/{anomalyResultId}/send")
    public String sendTubeAlert(@PathVariable Long anomalyResultId) {
        alertService.sendTubeAlert(anomalyResultId);
        return "Tube alert sent";
    }

    // -------------------------
    // 3. 알림 이력 조회
    // -------------------------
    @GetMapping
    public List<AlertResponse> getAlerts(
            @RequestParam(required = false) Long equipmentId,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String type
    ) {
        return alertService.getAlerts(equipmentId, severity, type);
    }
}