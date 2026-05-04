package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;
import org.example.backend.domain.anomaly.MotorAnomalyResult;

import java.time.LocalDateTime;

@Getter
@Builder
public class MotorAnomalyResponse {

    private Long anomalyResultId;
    private LocalDateTime measuredAt;
    private Double anomalyScore;
    private String severity;

    public static MotorAnomalyResponse from(
            MotorAnomalyResult result,
            String severity
    ) {
        return MotorAnomalyResponse.builder()
                .anomalyResultId(result.getMotorAnomalyResultId())
                .measuredAt(result.getMeasuredAt())
                .anomalyScore(result.getAnomalyScore())
                .severity(severity)
                .build();
    }
}