package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.domain.alert.AlertHistory;
import org.example.backend.domain.anomaly.AnomalyConfig;
import org.example.backend.domain.anomaly.MotorAnomalyResult;
import org.example.backend.domain.anomaly.TubeAnomalyResult;
import org.example.backend.domain.equipment.Equipment;
import org.example.backend.dto.response.AlertResponse;
import org.example.backend.global.enums.EquipmentType;
import org.example.backend.repository.AlertHistoryRepository;
import org.example.backend.repository.AnomalyConfigRepository;
import org.example.backend.repository.EquipmentRepository;
import org.example.backend.repository.MotorAnomalyResultRepository;
import org.example.backend.repository.TubeAnomalyResultRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AlertService {

    private final EquipmentRepository equipmentRepository;
    private final AnomalyConfigRepository anomalyConfigRepository;
    private final MotorAnomalyResultRepository motorAnomalyResultRepository;
    private final TubeAnomalyResultRepository tubeAnomalyResultRepository;
    private final AlertHistoryRepository alertHistoryRepository;
    private final SlackWebhookService slackWebhookService;

    public List<AlertResponse> getAlerts(Long equipmentId, String severity, String type) {
        String normalizedSeverity = severity == null ? null : severity.toUpperCase();
        String normalizedType = type == null ? null : type.toUpperCase();

        List<AlertHistory> alerts;

        if (equipmentId != null && normalizedSeverity != null && normalizedType != null) {
            alerts = alertHistoryRepository
                    .findByEquipmentIdAndSeverityAndAnomalyResultTypeOrderByOccurredAtDesc(equipmentId, normalizedSeverity, normalizedType);
        } else if (equipmentId != null && normalizedSeverity != null) {
            alerts = alertHistoryRepository.findByEquipmentIdAndSeverityOrderByOccurredAtDesc(equipmentId, normalizedSeverity);
        } else if (equipmentId != null && normalizedType != null) {
            alerts = alertHistoryRepository.findByEquipmentIdAndAnomalyResultTypeOrderByOccurredAtDesc(equipmentId, normalizedType);
        } else if (normalizedSeverity != null && normalizedType != null) {
            alerts = alertHistoryRepository.findBySeverityAndAnomalyResultTypeOrderByOccurredAtDesc(normalizedSeverity, normalizedType);
        } else if (equipmentId != null) {
            alerts = alertHistoryRepository.findByEquipmentIdOrderByOccurredAtDesc(equipmentId);
        } else if (normalizedSeverity != null) {
            alerts = alertHistoryRepository.findBySeverityOrderByOccurredAtDesc(normalizedSeverity);
        } else if (normalizedType != null) {
            alerts = alertHistoryRepository.findByAnomalyResultTypeOrderByOccurredAtDesc(normalizedType);
        } else {
            alerts = alertHistoryRepository.findAllByOrderByOccurredAtDesc();
        }

        return alerts.stream()
                .map(AlertResponse::from)
                .toList();
    }

    public void sendMotorAlert(Long anomalyResultId) {
        MotorAnomalyResult result = motorAnomalyResultRepository.findById(anomalyResultId)
                .orElseThrow(() -> new IllegalArgumentException("전동기 이상 감지 결과가 존재하지 않습니다."));

        Equipment equipment = equipmentRepository.findById(result.getEquipmentId())
                .orElseThrow(() -> new IllegalArgumentException("해당 설비가 존재하지 않습니다."));

        AnomalyConfig config = anomalyConfigRepository.findById(result.getConfigId())
                .orElseThrow(() -> new IllegalArgumentException("이상 판단 기준이 존재하지 않습니다."));

        processAlert(
                equipment,
                result.getMotorAnomalyResultId(),
                EquipmentType.MOTOR.name(),
                result.getMeasuredAt(),
                result.getAnomalyScore(),
                config
        );
    }

    public void sendTubeAlert(Long anomalyResultId) {
        TubeAnomalyResult result = tubeAnomalyResultRepository.findById(anomalyResultId)
                .orElseThrow(() -> new IllegalArgumentException("튜브 이상 감지 결과가 존재하지 않습니다."));

        Equipment equipment = equipmentRepository.findById(result.getEquipmentId())
                .orElseThrow(() -> new IllegalArgumentException("해당 설비가 존재하지 않습니다."));

        AnomalyConfig config = anomalyConfigRepository.findById(result.getConfigId())
                .orElseThrow(() -> new IllegalArgumentException("이상 판단 기준이 존재하지 않습니다."));

        processAlert(
                equipment,
                result.getTubeAnomalyResultId(),
                EquipmentType.TUBE.name(),
                result.getMeasuredAt(),
                result.getAnomalyScore(),
                config
        );
    }

    private void processAlert(
            Equipment equipment,
            Long anomalyResultId,
            String anomalyResultType,
            LocalDateTime occurredAt,
            Double anomalyScore,
            AnomalyConfig config
    ) {
        String currentSeverity = calculateSeverity(anomalyScore, config);

        String previousSeverity = alertHistoryRepository
                .findTopByEquipmentIdAndAnomalyResultTypeOrderByAlertIdDesc(
                        equipment.getEquipmentId(),
                        anomalyResultType
                )
                .map(AlertHistory::getSeverity)
                .orElse("NORMAL");

        if (previousSeverity.equals(currentSeverity)) {
            return;
        }

        String message = createMessage(equipment.getEquipmentName(), currentSeverity, anomalyScore, occurredAt);
        slackWebhookService.sendMessage(message);

        AlertHistory alertHistory = AlertHistory.builder()
                .equipmentId(equipment.getEquipmentId())
                .anomalyResultId(anomalyResultId)
                .anomalyResultType(anomalyResultType)
                .occurredAt(occurredAt)
                .severity(currentSeverity)
                .message(message)
                .channel("SLACK")
                .sendStatus("SUCCESS")
                .createdAt(LocalDateTime.now())
                .build();

        alertHistoryRepository.save(alertHistory);
    }

    private String calculateSeverity(Double score, AnomalyConfig config) {
        if (score >= config.getDangerThreshold()) {
            return "DANGER";
        }

        if (score >= config.getWarningThreshold()) {
            return "WARNING";
        }

        return "NORMAL";
    }

    private String createMessage(
            String equipmentName,
            String severity,
            Double anomalyScore,
            LocalDateTime occurredAt
    ) {
        if ("NORMAL".equals(severity)) {
            return "[NORMAL] 설비 상태가 정상으로 복구되었습니다.\n"
                    + "설비: " + equipmentName + "\n"
                    + "시간: " + occurredAt + "\n"
                    + "점수: " + anomalyScore;
        }

        return "[" + severity + "] 설비 이상이 감지되었습니다.\n"
                + "설비: " + equipmentName + "\n"
                + "시간: " + occurredAt + "\n"
                + "점수: " + anomalyScore;
    }
}
