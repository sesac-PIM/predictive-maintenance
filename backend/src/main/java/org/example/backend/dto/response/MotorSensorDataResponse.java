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
    private Double yi1593aa;
    private Double tt1227a;
    private Double yi1593ab;
    private Double yi1594aa;
    private Double yi1594ab;

    private Double ii1211b;
    private Double tt1228b;
    private Double yi1593ba;
    private Double tt1227b;
    private Double yi1593bb;
    private Double yi1594ba;
    private Double yi1594bb;

    private Double ii1442;
    private Double tt1427;
    private Double yi1483a;
    private Double tt1428;
    private Double yi1483b;
    private Double yi1484a;
    private Double yi1484b;

    private Double ii7140;
    private Double tt7111;
    private Double yi7364a;
    private Double tt7100;
    private Double yi7364b;
    private Double yi7365a;
    private Double yi7365b;

    private Double ii7145;
    private Double tt7152;
    private Double yi7358a;
    private Double tt7151;
    private Double yi7358b;
    private Double yi7359a;
    private Double yi7359b;

    public static MotorSensorDataResponse from(MotorSensorData data) {
        return MotorSensorDataResponse.builder()
                .motorSensorDataId(data.getMotorSensorDataId())
                .equipmentId(data.getEquipmentId())
                .measuredAt(data.getMeasuredAt())
                .ii1211a(data.getIi1211a())
                .tt1228a(data.getTt1228a())
                .yi1593aa(data.getYi1593aa())
                .tt1227a(data.getTt1227a())
                .yi1593ab(data.getYi1593ab())
                .yi1594aa(data.getYi1594aa())
                .yi1594ab(data.getYi1594ab())
                .ii1211b(data.getIi1211b())
                .tt1228b(data.getTt1228b())
                .yi1593ba(data.getYi1593ba())
                .tt1227b(data.getTt1227b())
                .yi1593bb(data.getYi1593bb())
                .yi1594ba(data.getYi1594ba())
                .yi1594bb(data.getYi1594bb())
                .ii1442(data.getIi1442())
                .tt1427(data.getTt1427())
                .yi1483a(data.getYi1483a())
                .tt1428(data.getTt1428())
                .yi1483b(data.getYi1483b())
                .yi1484a(data.getYi1484a())
                .yi1484b(data.getYi1484b())
                .ii7140(data.getIi7140())
                .tt7111(data.getTt7111())
                .yi7364a(data.getYi7364a())
                .tt7100(data.getTt7100())
                .yi7364b(data.getYi7364b())
                .yi7365a(data.getYi7365a())
                .yi7365b(data.getYi7365b())
                .ii7145(data.getIi7145())
                .tt7152(data.getTt7152())
                .yi7358a(data.getYi7358a())
                .tt7151(data.getTt7151())
                .yi7358b(data.getYi7358b())
                .yi7359a(data.getYi7359a())
                .yi7359b(data.getYi7359b())
                .build();
    }
}
