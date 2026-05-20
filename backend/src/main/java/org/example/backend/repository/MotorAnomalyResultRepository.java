package org.example.backend.repository;

import org.example.backend.domain.anomaly.MotorAnomalyResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface MotorAnomalyResultRepository
        extends JpaRepository<MotorAnomalyResult, Long> {

    List<MotorAnomalyResult> findByEquipmentId(Long equipmentId);
}