package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class MotorAnomalyResponse {

    private String equipmentType;
    private String componentName;
    private Long anomalyResultId;
    private LocalDateTime measuredAt;
    private Double anomalyScore;
    private String severity;

    private String eventType;
    private Integer durationSec;
    private String description;
}
