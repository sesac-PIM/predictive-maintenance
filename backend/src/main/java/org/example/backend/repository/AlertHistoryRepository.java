package org.example.backend.repository;

import org.example.backend.domain.alert.AlertHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AlertHistoryRepository extends JpaRepository<AlertHistory, Long> {

    List<AlertHistory> findAllByOrderByOccurredAtDesc();

    List<AlertHistory> findAllByOrderByOccurredAtDesc(Pageable pageable);

    List<AlertHistory> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<AlertHistory> findBySeverityOrderByOccurredAtDesc(String severity);

    List<AlertHistory> findBySeverityOrderByOccurredAtDesc(
            String severity,
            Pageable pageable
    );

    List<AlertHistory> findByEquipmentIdOrderByOccurredAtDesc(Long equipmentId);

    List<AlertHistory> findByEquipmentIdOrderByOccurredAtDesc(
            Long equipmentId,
            Pageable pageable
    );

    List<AlertHistory> findByAnomalyResultTypeOrderByOccurredAtDesc(String anomalyResultType);

    List<AlertHistory> findByAnomalyResultTypeOrderByOccurredAtDesc(
            String anomalyResultType,
            Pageable pageable
    );

    List<AlertHistory> findByEquipmentIdAndSeverityOrderByOccurredAtDesc(
            Long equipmentId,
            String severity
    );

    List<AlertHistory> findByEquipmentIdAndSeverityOrderByOccurredAtDesc(
            Long equipmentId,
            String severity,
            Pageable pageable
    );

    List<AlertHistory> findByEquipmentIdAndAnomalyResultTypeOrderByOccurredAtDesc(
            Long equipmentId,
            String anomalyResultType
    );

    List<AlertHistory> findByEquipmentIdAndAnomalyResultTypeOrderByOccurredAtDesc(
            Long equipmentId,
            String anomalyResultType,
            Pageable pageable
    );

    List<AlertHistory> findBySeverityAndAnomalyResultTypeOrderByOccurredAtDesc(
            String severity,
            String anomalyResultType
    );

    List<AlertHistory> findBySeverityAndAnomalyResultTypeOrderByOccurredAtDesc(
            String severity,
            String anomalyResultType,
            Pageable pageable
    );

    List<AlertHistory> findByEquipmentIdAndSeverityAndAnomalyResultTypeOrderByOccurredAtDesc(
            Long equipmentId,
            String severity,
            String anomalyResultType
    );

    List<AlertHistory> findByEquipmentIdAndSeverityAndAnomalyResultTypeOrderByOccurredAtDesc(
            Long equipmentId,
            String severity,
            String anomalyResultType,
            Pageable pageable
    );

    Optional<AlertHistory> findTopByEquipmentIdOrderByOccurredAtDesc(Long equipmentId);

    Optional<AlertHistory> findTopByEquipmentIdAndAnomalyResultTypeOrderByAlertIdDesc(
            Long equipmentId,
            String anomalyResultType
    );
}
