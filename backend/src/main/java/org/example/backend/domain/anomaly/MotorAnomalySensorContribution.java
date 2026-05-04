package org.example.backend.domain.anomaly;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.LocalDateTime;

@Entity
@Table(name = "motor_anomaly_sensor_contribution")
@Getter
public class MotorAnomalySensorContribution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long motorContributionId;

    private Long motorAnomalyResultId;

    @Column(name = "sensor_tag")
    private String sensorTag;

    private Double sensorValue;

    private Double contributionScore;

    private Integer contributionRank;

    private LocalDateTime createdAt;
}