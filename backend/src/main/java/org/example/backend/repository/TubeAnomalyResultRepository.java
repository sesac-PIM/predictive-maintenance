package org.example.backend.repository;

import org.example.backend.domain.anomaly.TubeAnomalyResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TubeAnomalyResultRepository
        extends JpaRepository<TubeAnomalyResult, Long> {

    List<TubeAnomalyResult> findByEquipmentIdOrderByMeasuredAtDesc(Long equipmentId);
}
