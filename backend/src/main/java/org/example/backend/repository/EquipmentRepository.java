package org.example.backend.repository;

import org.example.backend.domain.equipment.Equipment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EquipmentRepository extends JpaRepository<Equipment, Long> {
}