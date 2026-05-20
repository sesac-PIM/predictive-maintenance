package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;
import org.example.backend.domain.equipment.Equipment;

@Getter
@Builder
public class EquipmentResponse {

    private Long equipmentId;
    private String plantName;
    private Integer unitNo;
    private String equipmentName;
    private String equipmentType;
    private String status;

    public static EquipmentResponse from(Equipment e) {
        return EquipmentResponse.builder()
                .equipmentId(e.getEquipmentId())
                .plantName(e.getPlant().getPlantName())
                .equipmentName(e.getEquipmentName())
                .equipmentType(e.getEquipmentType().name())
                .status(e.getStatus().name())
                .unitNo(e.getUnitNo())
                .build();
    }
}