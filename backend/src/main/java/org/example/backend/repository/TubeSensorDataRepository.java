package org.example.backend.repository;

import org.example.backend.domain.sensor.TubeSensorData;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TubeSensorDataRepository
        extends JpaRepository<TubeSensorData, Long> {

    List<TubeSensorData> findByEquipmentId(Long equipmentId);
}