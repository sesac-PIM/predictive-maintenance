package org.example.backend.domain.anomaly;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.LocalDateTime;

@Entity
@Table(name = "tube_anomaly_sensor_contribution")
@Getter
public class TubeAnomalySensorContribution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tube_contribution_id")
    private Long tubeContributionId;

    @Column(name = "tube_anomaly_result_id", nullable = false)
    private Long tubeAnomalyResultId;

    @Column(name = "sensor_tag", nullable = false)
    private String sensorTag;

    @Column(name = "sensor_value")
    private Double sensorValue;

    @Column(name = "contribution_score")
    private Double contributionScore;

    @Column(name = "contribution_rank")
    private Integer contributionRank;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}