package org.example.backend.domain.anomaly;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.LocalDateTime;

@Entity
@Table(name = "tube_anomaly_result")
@Getter
public class TubeAnomalyResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tube_anomaly_result_id")
    private Long tubeAnomalyResultId;

    @Column(name = "equipment_id", nullable = false)
    private Long equipmentId;

    @Column(name = "config_id", nullable = false)
    private Long configId;

    @Column(name = "window_start_at", nullable = false)
    private LocalDateTime windowStartAt;

    @Column(name = "window_end_at", nullable = false)
    private LocalDateTime windowEndAt;

    @Column(name = "measured_at", nullable = false)
    private LocalDateTime measuredAt;

    @Column(name = "anomaly_score", nullable = false)
    private Double anomalyScore;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}