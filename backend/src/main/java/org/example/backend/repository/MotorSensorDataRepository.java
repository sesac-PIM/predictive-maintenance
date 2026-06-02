package org.example.backend.repository;

import org.example.backend.domain.sensor.MotorSensorData;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MotorSensorDataRepository extends JpaRepository<MotorSensorData, Long> {

    List<MotorSensorData> findByEquipmentIdOrderByMeasuredAtDesc(Long equipmentId);

    List<MotorSensorData> findByEquipmentIdOrderByMeasuredAtDesc(
            Long equipmentId,
            Pageable pageable
    );
}
