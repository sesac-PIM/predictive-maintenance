package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;
import org.example.backend.domain.plant.Plant;

@Getter
@Builder
public class PlantResponse {

    private Long plantId;
    private String plantName;
    private String location;
    private Double latitude;
    private Double longitude;

    public static PlantResponse from(Plant plant) {
        return PlantResponse.builder()
                .plantId(plant.getPlantId())
                .plantName(plant.getPlantName())
                .location(plant.getLocation())
                .latitude(plant.getLatitude())
                .longitude(plant.getLongitude())
                .build();
    }
}