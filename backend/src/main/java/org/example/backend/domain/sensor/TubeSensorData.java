package org.example.backend.domain.sensor;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.LocalDateTime;

@Entity
@Table(name = "tube_sensor_data")
@Getter
public class TubeSensorData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tube_sensor_data_id")
    private Long tubeSensorDataId;

    @Column(name = "equipment_id", nullable = false)
    private Long equipmentId;

    @Column(name = "measured_at", nullable = false)
    private LocalDateTime measuredAt;

    @Column(name = "tag_13tt0064")
    private Double tag13tt0064;

    @Column(name = "tag_15pdt0002a")
    private Double tag15pdt0002a;

    @Column(name = "tag_13pdt0067")
    private Double tag13pdt0067;

    @Column(name = "tag_13fi0044")
    private Double tag13fi0044;

    @Column(name = "tag_13ffyc0046")
    private Double tag13ffyc0046;

    @Column(name = "tag_13fy0045")
    private Double tag13fy0045;

    @Column(name = "tag_13jyi9001")
    private Double tag13jyi9001;

    @Column(name = "tag_10ind0001")
    private Double tag10ind0001;

    @Column(name = "bopc1_1_16200_fi_po041")
    private Double bopc1116200FiPo041;
}