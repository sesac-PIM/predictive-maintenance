package org.example.backend.repository;

import org.example.backend.domain.sensor.MotorSensorThreshold;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MotorSensorThresholdRepository
        extends JpaRepository<MotorSensorThreshold, Long> {

    List<MotorSensorThreshold> findByConfigId(Long configId);
}