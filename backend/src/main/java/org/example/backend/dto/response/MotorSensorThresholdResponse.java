package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;
import org.example.backend.domain.sensor.MotorSensorThreshold;

@Getter
@Builder
public class MotorSensorThresholdResponse {

    private String sensorTag;
    private String displayName;
    private Double threshold;

    public static MotorSensorThresholdResponse from(
            MotorSensorThreshold threshold,
            String displayName
    ) {
        return MotorSensorThresholdResponse.builder()
                .sensorTag(threshold.getSensorTag())
                .displayName(displayName)
                .threshold(threshold.getThreshold())
                .build();
    }
}