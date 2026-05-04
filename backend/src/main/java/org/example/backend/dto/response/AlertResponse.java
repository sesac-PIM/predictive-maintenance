package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;
import org.example.backend.domain.alert.AlertHistory;

import java.time.LocalDateTime;

@Getter
@Builder
public class AlertResponse {

    private Long alertId;
    private Long equipmentId;
    private Long anomalyResultId;
    private String anomalyResultType;
    private LocalDateTime occurredAt;
    private String severity;
    private String message;
    private String channel;
    private String sendStatus;

    public static AlertResponse from(AlertHistory alert) {
        return AlertResponse.builder()
                .alertId(alert.getAlertId())
                .equipmentId(alert.getEquipmentId())
                .anomalyResultId(alert.getAnomalyResultId())
                .anomalyResultType(alert.getAnomalyResultType())
                .occurredAt(alert.getOccurredAt())
                .severity(alert.getSeverity())
                .message(alert.getMessage())
                .channel(alert.getChannel())
                .sendStatus(alert.getSendStatus())
                .build();
    }
}