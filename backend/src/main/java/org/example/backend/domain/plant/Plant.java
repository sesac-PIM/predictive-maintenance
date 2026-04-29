package org.example.backend.domain.plant;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "plant")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Plant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "plant_id")
    private Long plantId;

    @Column(name = "plant_name", nullable = false)
    private String plantName;

    private String location;

    private Double latitude;

    private Double longitude;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}