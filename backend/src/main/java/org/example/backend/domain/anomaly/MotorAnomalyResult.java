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

    private LocalDateTime createdAt;

    private Long equipmentId;

    private LocalDateTime windowStartAt;

    private LocalDateTime windowEndAt;
}