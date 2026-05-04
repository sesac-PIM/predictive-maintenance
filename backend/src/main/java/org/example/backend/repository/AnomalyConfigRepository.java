package org.example.backend.repository;

import org.example.backend.domain.anomaly.AnomalyConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.example.backend.global.enums.EquipmentType;
import java.util.Optional;

public interface AnomalyConfigRepository extends JpaRepository<AnomalyConfig, Long> {

    Optional<AnomalyConfig> findByEquipmentTypeAndIsActiveTrue(EquipmentType equipmentType);
}