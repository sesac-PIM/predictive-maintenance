package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class SensorThresholdResponse {

    private String equipmentType;
    private String sensorTag;
    private String displayName;
    private LocalDateTime windowStartAt;
    private LocalDateTime windowEndAt;
    private Double lowerThreshold;
    private Double upperThreshold;
}