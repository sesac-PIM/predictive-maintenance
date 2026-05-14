package org.example.backend.domain.anomaly;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.LocalDateTime;

@Entity
@Table(name = "motor_anomaly_result")
@Getter
public class MotorAnomalyResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long motorAnomalyResultId;

    private Long configId;

    private LocalDateTime measuredAt;

    private Double anomalyScore;

    private String eventType;

    private Integer durationSec;

    private  String description;

    private LocalDateTime createdAt;

    private Long equipmentId;

    private LocalDateTime windowStartAt;

    private LocalDateTime windowEndAt;
}