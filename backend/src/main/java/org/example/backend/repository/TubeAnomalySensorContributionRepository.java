package org.example.backend.repository;

import org.example.backend.domain.anomaly.TubeAnomalySensorContribution;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TubeAnomalySensorContributionRepository
        extends JpaRepository<TubeAnomalySensorContribution, Long> {

    List<TubeAnomalySensorContribution> findByTubeAnomalyResultIdOrderByContributionRankAsc(
            Long tubeAnomalyResultId
    );
}