package org.example.backend.repository;

import org.example.backend.domain.sensor.MotorSensorThreshold;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface MotorSensorThresholdRepository
        extends JpaRepository<MotorSensorThreshold, Long> {

    @Query("""
            SELECT m
            FROM MotorSensorThreshold m
            WHERE m.equipmentId = :equipmentId
              AND m.configId = :configId
              AND m.windowEndAt = (
                  SELECT MAX(m2.windowEndAt)
                  FROM MotorSensorThreshold m2
                  WHERE m2.equipmentId = :equipmentId
                    AND m2.configId = :configId
              )
            ORDER BY m.sensorTag ASC
            """)
    List<MotorSensorThreshold> findLatestByEquipmentIdAndConfigId(
            Long equipmentId,
            Long configId
    );
}