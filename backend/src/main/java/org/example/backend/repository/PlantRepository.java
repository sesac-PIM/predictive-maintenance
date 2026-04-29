package org.example.backend.repository;

import org.example.backend.domain.plant.Plant;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlantRepository extends JpaRepository<Plant, Long> {
}