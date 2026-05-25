package org.example.backend.repository;

import org.example.backend.domain.anomaly.MotorAnomalyResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MotorAnomalyResultRepository
        extends JpaRepository<MotorAnomalyResult, Long> {

    List<MotorAnomalyResult> findByEquipmentIdOrderByMeasuredAtDesc(Long equipmentId);

    List<MotorAnomalyResult> findTop100ByAlertProcessedFalseOrderByMotorAnomalyResultIdAsc();
}
