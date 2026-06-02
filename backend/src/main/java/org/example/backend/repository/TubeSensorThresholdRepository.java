package org.example.backend.repository;

import org.example.backend.domain.sensor.TubeSensorThreshold;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TubeSensorThresholdRepository
        extends JpaRepository<TubeSensorThreshold, Long> {

    @Query("""
            SELECT t
            FROM TubeSensorThreshold t
            WHERE t.equipmentId = :equipmentId
              AND t.configId = :configId
              AND t.windowEndAt = (
                  SELECT MAX(t2.windowEndAt)
                  FROM TubeSensorThreshold t2
                  WHERE t2.equipmentId = :equipmentId
                    AND t2.configId = :configId
              )
            ORDER BY t.sensorTag ASC
            """)
    List<TubeSensorThreshold> findLatestByEquipmentIdAndConfigId(
            Long equipmentId,
            Long configId
    );
}