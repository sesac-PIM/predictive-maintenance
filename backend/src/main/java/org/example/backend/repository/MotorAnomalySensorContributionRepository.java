package org.example.backend.repository;

import org.example.backend.domain.anomaly.MotorAnomalySensorContribution;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MotorAnomalySensorContributionRepository
        extends JpaRepository<MotorAnomalySensorContribution, Long> {

    List<MotorAnomalySensorContribution> findByMotorAnomalyResultIdOrderByContributionRankAsc(
            Long motorAnomalyResultId
    );
}