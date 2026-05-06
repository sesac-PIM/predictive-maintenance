package org.example.backend.domain.sensor;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.LocalDateTime;

@Entity
@Table(name = "tube_sensor_threshold")
@Getter
public class TubeSensorThreshold {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tube_sensor_threshold_id")
    private Long tubeSensorThresholdId;

    @Column(name = "equipment_id", nullable = false)
    private Long equipmentId;

    @Column(name = "config_id", nullable = false)
    private Long configId;

    @Column(name = "sensor_tag", nullable = false)
    private String sensorTag;

    @Column(name = "window_start_at", nullable = false)
    private LocalDateTime windowStartAt;

    @Column(name = "window_end_at", nullable = false)
    private LocalDateTime windowEndAt;

    @Column(name = "lower_threshold", nullable = false)
    private Double lowerThreshold;

    @Column(name = "upper_threshold", nullable = false)
    private Double upperThreshold;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}