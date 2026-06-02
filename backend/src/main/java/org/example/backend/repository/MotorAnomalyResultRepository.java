package org.example.backend.repository;

import org.example.backend.domain.anomaly.MotorAnomalyResult;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface MotorAnomalyResultRepository
        extends JpaRepository<MotorAnomalyResult, Long> {

    List<MotorAnomalyResult> findByEquipmentIdOrderByMeasuredAtDesc(Long equipmentId);

    List<MotorAnomalyResult> findByEquipmentIdOrderByMeasuredAtDesc(
            Long equipmentId,
            Pageable pageable
    );

    List<MotorAnomalyResult> findByEquipmentIdAndComponentNameOrderByMeasuredAtDesc(
            Long equipmentId,
            String componentName
    );

    List<MotorAnomalyResult> findByEquipmentIdAndComponentNameOrderByMeasuredAtDesc(
            Long equipmentId,
            String componentName,
            Pageable pageable
    );

    List<MotorAnomalyResult> findByEquipmentIdAndMeasuredAt(
            Long equipmentId,
            LocalDateTime measuredAt
    );

    List<MotorAnomalyResult> findTop100ByAlertProcessedFalseOrderByMotorAnomalyResultIdAsc();
}
