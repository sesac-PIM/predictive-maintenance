package org.example.backend.domain.alert;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "alert_history")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class AlertHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "alert_id")
    private Long alertId;

    @Column(name = "equipment_id", nullable = false)
    private Long equipmentId;

    @Column(name = "anomaly_result_id", nullable = false)
    private Long anomalyResultId;

    @Column(name = "anomaly_result_type", nullable = false)
    private String anomalyResultType;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;

    @Column(name = "severity", nullable = false)
    private String severity;

    @Column(name = "message")
    private String message;

    @Column(name = "channel")
    private String channel;

    @Column(name = "send_status")
    private String sendStatus;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}