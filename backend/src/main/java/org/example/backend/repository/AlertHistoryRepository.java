package org.example.backend.repository;

import org.example.backend.domain.alert.AlertHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AlertHistoryRepository extends JpaRepository<AlertHistory, Long> {

    List<AlertHistory> findAllByOrderByOccurredAtDesc();

    Optional<AlertHistory> findTopByEquipmentIdOrderByOccurredAtDesc(Long equipmentId);
}