package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;
import org.example.backend.domain.sensor.MotorSensorData;

import java.time.LocalDateTime;

@Getter
@Builder
public class MotorSensorDataResponse {

    private Long motorSensorDataId;
    private Long equipmentId;
    private LocalDateTime measuredAt;
    private Double ii1211a;
    private Double tt1228a;

    public static MotorSensorDataResponse from(MotorSensorData data) {
        return MotorSensorDataResponse.builder()
                .motorSensorDataId(data.getMotorSensorDataId())
                .equipmentId(data.getEquipmentId())
                .measuredAt(data.getMeasuredAt())
                .ii1211a(data.getIi1211a())
                .tt1228a(data.getTt1228a())
                .build();
    }
}