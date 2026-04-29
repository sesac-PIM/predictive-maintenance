package org.example.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class EquipmentSummaryResponse {

    private long totalCount;
    private long normalCount;
    private long warningCount;
    private long dangerCount;
}