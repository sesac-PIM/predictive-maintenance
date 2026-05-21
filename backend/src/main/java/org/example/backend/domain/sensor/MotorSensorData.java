package org.example.backend.domain.sensor;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;

import java.time.LocalDateTime;

@Entity
@Table(name = "motor_sensor_data")
@Getter
public class MotorSensorData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
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
}
