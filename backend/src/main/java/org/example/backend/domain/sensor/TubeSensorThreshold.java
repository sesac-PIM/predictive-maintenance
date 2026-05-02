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

    @Column(name = "config_id", nullable = false)
    private Long configId;

    @Column(name = "sensor_tag", nullable = false)
    private String sensorTag;

    @Column(name = "threshold", nullable = false)
    private Double threshold;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}