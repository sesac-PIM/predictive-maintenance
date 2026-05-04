package org.example.backend.repository;

import org.example.backend.domain.sensor.TubeSensorThreshold;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TubeSensorThresholdRepository
        extends JpaRepository<TubeSensorThreshold, Long> {

    List<TubeSensorThreshold> findByConfigId(Long configId);
}