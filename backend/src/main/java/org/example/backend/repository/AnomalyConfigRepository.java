package org.example.backend.repository;

import org.example.backend.domain.anomaly.AnomalyConfig;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnomalyConfigRepository extends JpaRepository<AnomalyConfig, Long> {
}