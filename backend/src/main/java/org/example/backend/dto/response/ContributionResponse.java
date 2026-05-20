package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ContributionResponse {

    private String equipmentType;
    private String sensorTag;
    private String displayName;
    private Double sensorValue;
    private Double contributionScore;
    private Integer contributionRank;
}