package org.example.backend.domain.sensor;

import jakarta.persistence.*;
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
}