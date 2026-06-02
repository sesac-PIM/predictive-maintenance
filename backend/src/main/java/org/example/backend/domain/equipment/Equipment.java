package org.example.backend.domain.equipment;

import jakarta.persistence.*;
import lombok.*;
import org.example.backend.domain.plant.Plant;
import org.example.backend.global.enums.EquipmentStatus;
import org.example.backend.global.enums.EquipmentType;

import java.time.LocalDateTime;

@Entity
@Table(name = "equipment")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Equipment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "equipment_id")
    private Long equipmentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plant_id", nullable = false)
    private Plant plant;

    @Column(name = "equipment_name", nullable = false)
    private String equipmentName;

    @Enumerated(EnumType.STRING)
    @Column(name = "equipment_type", nullable = false)
    private EquipmentType equipmentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EquipmentStatus status;

    @Column(name = "status_updated_at")
    private LocalDateTime statusUpdatedAt;

    private String description;

    private Integer unitNo;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public void updateStatus(EquipmentStatus status, LocalDateTime statusUpdatedAt) {
        this.status = status;
        this.statusUpdatedAt = statusUpdatedAt;
    }
}
