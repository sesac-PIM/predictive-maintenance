package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;
import org.example.backend.domain.sensor.TubeSensorThreshold;

@Getter
@Builder
public class TubeSensorThresholdResponse {

    private String sensorTag;
    private String displayName;
    private Double lowerThreshold;
    private Double upperThreshold;

    public static TubeSensorThresholdResponse from(
            TubeSensorThreshold threshold,
            String displayName
    ) {
        return TubeSensorThresholdResponse.builder()
                .sensorTag(threshold.getSensorTag())
                .displayName(displayName)
                .lowerThreshold(threshold.getLowerThreshold())
                .upperThreshold(threshold.getUpperThreshold())
                .build();
    }
}