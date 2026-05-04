package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SensorThresholdResponse {

    private String equipmentType;
    private String sensorTag;
    private String displayName;
    private Double lowerThreshold;
    private Double upperThreshold;
}