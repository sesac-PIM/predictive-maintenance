package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;
import org.example.backend.domain.anomaly.MotorAnomalySensorContribution;

@Getter
@Builder
public class MotorAnomalyContributionResponse {

    private String sensorTag;
    private String displayName;
    private Double sensorValue;
    private Double contributionScore;
    private Integer contributionRank;

    public static MotorAnomalyContributionResponse from(
            MotorAnomalySensorContribution contribution,
            String displayName
    ) {
        return MotorAnomalyContributionResponse.builder()
                .sensorTag(contribution.getSensorTag())
                .displayName(displayName)
                .sensorValue(contribution.getSensorValue())
                .contributionScore(contribution.getContributionScore())
                .contributionRank(contribution.getContributionRank())
                .build();
    }
}