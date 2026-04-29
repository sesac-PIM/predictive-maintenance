package org.example.backend.domain.anomaly;

import jakarta.persistence.*;
import lombok.*;
import org.example.backend.global.enums.EquipmentType;

import java.time.LocalDateTime;

@Entity
@Table(name = "anomaly_config")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class AnomalyConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "config_id")
    private Long configId;

    @Enumerated(EnumType.STRING)
    @Column(name = "equipment_type", nullable = false)
    private EquipmentType equipmentType;

    @Column(name = "model_version", nullable = false)
    private String modelVersion;

    @Column(name = "warning_threshold", nullable = false)
    private Double warningThreshold;

    @Column(name = "danger_threshold", nullable = false)
    private Double dangerThreshold;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}