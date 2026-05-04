package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;
import org.example.backend.domain.anomaly.TubeAnomalyResult;

import java.time.LocalDateTime;

@Getter
@Builder
public class TubeAnomalyResponse {

    private Long anomalyResultId;
    private LocalDateTime measuredAt;
    private Double anomalyScore;
    private String severity;

    public static TubeAnomalyResponse from(
            TubeAnomalyResult result,
            String severity
    ) {
        return TubeAnomalyResponse.builder()
                .anomalyResultId(result.getTubeAnomalyResultId())
                .measuredAt(result.getMeasuredAt())
                .anomalyScore(result.getAnomalyScore())
                .severity(severity)
                .build();
    }
}