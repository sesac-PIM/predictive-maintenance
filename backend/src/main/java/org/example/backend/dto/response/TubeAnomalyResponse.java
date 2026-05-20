package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class TubeAnomalyResponse {

    private String equipmentType;
    private Long anomalyResultId;
    private LocalDateTime measuredAt;
    private Double anomalyScore;
    private String severity;
}