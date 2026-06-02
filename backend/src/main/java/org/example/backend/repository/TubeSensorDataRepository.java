package org.example.backend.repository;

import org.example.backend.domain.sensor.TubeSensorData;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TubeSensorDataRepository
        extends JpaRepository<TubeSensorData, Long> {

    List<TubeSensorData> findByEquipmentIdOrderByMeasuredAtDesc(Long equipmentId);

    List<TubeSensorData> findByEquipmentIdOrderByMeasuredAtDesc(
            Long equipmentId,
            Pageable pageable
    );
}
