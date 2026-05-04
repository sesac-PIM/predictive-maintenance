package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;
import org.example.backend.domain.anomaly.TubeAnomalySensorContribution;

@Getter
@Builder
public class TubeAnomalyContributionResponse {

    private String sensorTag;
    private String displayName;
    private Double sensorValue;
    private Double contributionScore;
    private Integer contributionRank;

    public static TubeAnomalyContributionResponse from(
            TubeAnomalySensorContribution contribution,
            String displayName
    ) {
        return TubeAnomalyContributionResponse.builder()
                .sensorTag(contribution.getSensorTag())
                .displayName(displayName)
                .sensorValue(contribution.getSensorValue())
                .contributionScore(contribution.getContributionScore())
                .contributionRank(contribution.getContributionRank())
                .build();
    }
}