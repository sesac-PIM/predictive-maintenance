package org.example.backend.repository;

import org.example.backend.domain.equipment.Equipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface EquipmentRepository extends JpaRepository<Equipment, Long> {

    List<Equipment> findByPlant_PlantId(Long plantId);

    @Query("SELECT COUNT(e) FROM Equipment e")
    long countAll();

    @Query("SELECT COUNT(e) FROM Equipment e WHERE e.status = 'NORMAL'")
    long countNormal();

    @Query("SELECT COUNT(e) FROM Equipment e WHERE e.status = 'WARNING'")
    long countWarning();

    @Query("SELECT COUNT(e) FROM Equipment e WHERE e.status = 'DANGER'")
    long countDanger();
}