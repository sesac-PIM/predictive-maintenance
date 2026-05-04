package org.example.backend.dto.response;

import lombok.Builder;
import lombok.Getter;
import org.example.backend.domain.sensor.TubeSensorData;

import java.time.LocalDateTime;

@Getter
@Builder
public class TubeSensorDataResponse {

    private Long tubeSensorDataId;
    private Long equipmentId;
    private LocalDateTime measuredAt;

    private Double tag13tt0064;
    private Double tag15pdt0002a;
    private Double tag13pdt0067;
    private Double tag13fi0044;
    private Double tag13ffyc0046;
    private Double tag13fy0045;
    private Double tag13jyi9001;
    private Double tag10ind0001;
    private Double bopc1116200FiPo041;

    public static TubeSensorDataResponse from(TubeSensorData data) {
        return TubeSensorDataResponse.builder()
                .tubeSensorDataId(data.getTubeSensorDataId())
                .equipmentId(data.getEquipmentId())
                .measuredAt(data.getMeasuredAt())
                .tag13tt0064(data.getTag13tt0064())
                .tag15pdt0002a(data.getTag15pdt0002a())
                .tag13pdt0067(data.getTag13pdt0067())
                .tag13fi0044(data.getTag13fi0044())
                .tag13ffyc0046(data.getTag13ffyc0046())
                .tag13fy0045(data.getTag13fy0045())
                .tag13jyi9001(data.getTag13jyi9001())
                .tag10ind0001(data.getTag10ind0001())
                .bopc1116200FiPo041(data.getBopc1116200FiPo041())
                .build();
    }
}