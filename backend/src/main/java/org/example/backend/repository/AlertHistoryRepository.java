package org.example.backend.repository;

import org.example.backend.domain.alert.AlertHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AlertHistoryRepository extends JpaRepository<AlertHistory, Long> {

    List<AlertHistory> findAllByOrderByOccurredAtDesc();

    List<AlertHistory> findBySeverityOrderByOccurredAtDesc(String severity);

    List<AlertHistory> findByEquipmentIdOrderByOccurredAtDesc(Long equipmentId);

    List<AlertHistory> findByAnomalyResultTypeOrderByOccurredAtDesc(String anomalyResultType);

    List<AlertHistory> findByEquipmentIdAndSeverityOrderByOccurredAtDesc(
            Long equipmentId,
            String severity
    );

    List<AlertHistory> findByEquipmentIdAndAnomalyResultTypeOrderByOccurredAtDesc(
            Long equipmentId,
            String anomalyResultType
    );

    List<AlertHistory> findBySeverityAndAnomalyResultTypeOrderByOccurredAtDesc(
            String severity,
            String anomalyResultType
    );

    List<AlertHistory> findByEquipmentIdAndSeverityAndAnomalyResultTypeOrderByOccurredAtDesc(
            Long equipmentId,
            String severity,
            String anomalyResultType
    );

    Optional<AlertHistory> findTopByEquipmentIdOrderByOccurredAtDesc(Long equipmentId);

    Optional<AlertHistory> findTopByEquipmentIdAndAnomalyResultTypeOrderByAlertIdDesc(
            Long equipmentId,
            String anomalyResultType
    );
}