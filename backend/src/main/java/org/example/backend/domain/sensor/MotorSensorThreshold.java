package org.example.backend.domain.sensor;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.LocalDateTime;

@Entity
@Table(name = "motor_sensor_threshold")
@Getter
public class MotorSensorThreshold {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "motor_sensor_threshold_id")
    private Long motorSensorThresholdId;

    @Column(name = "config_id", nullable = false)
    private Long configId;

    @Column(name = "sensor_tag", nullable = false)
    private String sensorTag;

    @Column(name = "lower_threshold", nullable = false)
    private Double lowerThreshold;

    @Column(name = "upper_threshold", nullable = false)
    private Double upperThreshold;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}