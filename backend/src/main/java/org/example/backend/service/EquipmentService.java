package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.domain.anomaly.AnomalyConfig;
import org.example.backend.domain.anomaly.MotorAnomalyResult;
import org.example.backend.domain.sensor.MotorSensorData;
import org.example.backend.domain.sensor.MotorSensorThreshold;
import org.example.backend.dto.response.*;
import org.example.backend.repository.*;
import org.springframework.stereotype.Service;
import org.example.backend.domain.anomaly.MotorAnomalySensorContribution;
import org.example.backend.dto.response.MotorAnomalyContributionResponse;
import org.example.backend.repository.MotorAnomalySensorContributionRepository;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EquipmentService {

    private final EquipmentRepository equipmentRepository;
    private final MotorSensorDataRepository motorSensorDataRepository;
    private final MotorSensorThresholdRepository motorSensorThresholdRepository;
    private final MotorAnomalyResultRepository motorAnomalyResultRepository;
    private final AnomalyConfigRepository anomalyConfigRepository;
    private final MotorAnomalySensorContributionRepository motorAnomalySensorContributionRepository;

    // -------------------------
    // sensorTag → displayName 매핑
    // -------------------------
    private static final Map<String, String> sensorDisplayNameMap = Map.of(
            "ii1211a", "전류",
            "tt1228a", "NDE 베어링 온도",
            "yi1593aa", "NDE 진동 1"
    );

    // -------------------------
    // 1. 설비 전체 조회
    // -------------------------
    public List<EquipmentResponse> getEquipments() {
        return equipmentRepository.findAll()
                .stream()
                .map(EquipmentResponse::from)
                .toList();
    }

    // -------------------------
    // 2. 설비 상태 요약
    // -------------------------
    public EquipmentSummaryResponse getEquipmentSummary() {
        long totalCount = equipmentRepository.countAll();
        long normalCount = equipmentRepository.countNormal();
        long warningCount = equipmentRepository.countWarning();
        long dangerCount = equipmentRepository.countDanger();

        return new EquipmentSummaryResponse(
                totalCount,
                normalCount,
                warningCount,
                dangerCount
        );
    }

    // -------------------------
    // 3. 설비 상세 조회
    // -------------------------
    public EquipmentResponse getEquipment(Long equipmentId) {
        return equipmentRepository.findById(equipmentId)
                .map(EquipmentResponse::from)
                .orElseThrow(() -> new IllegalArgumentException("해당 설비가 존재하지 않습니다."));
    }

    // -------------------------
    // 4. 센서 데이터 조회
    // -------------------------
    public List<MotorSensorDataResponse> getSensorData(Long equipmentId) {

        List<MotorSensorData> sensorDataList =
                motorSensorDataRepository.findByEquipmentId(equipmentId);

        return sensorDataList.stream()
                .map(MotorSensorDataResponse::from)
                .toList();
    }

    // -------------------------
    // 5. 센서 임계값 조회
    // -------------------------
    public List<MotorSensorThresholdResponse> getSensorThresholds(Long equipmentId) {

        // 현재 active config (임시)
        AnomalyConfig config = anomalyConfigRepository.findById(1L)
                .orElseThrow(IllegalArgumentException::new);

        List<MotorSensorThreshold> thresholdList =
                motorSensorThresholdRepository.findByConfigId(config.getConfigId());

        return thresholdList.stream()
                .map(threshold -> {

                    String displayName = sensorDisplayNameMap.getOrDefault(
                            threshold.getSensorTag(),
                            threshold.getSensorTag()
                    );

                    return MotorSensorThresholdResponse.from(
                            threshold,
                            displayName
                    );
                })
                .toList();
    }

    // -------------------------
    // 6. severity 계산
    // -------------------------
    private String calculateSeverity(Double score, AnomalyConfig config) {

        if (score >= config.getDangerThreshold()) {
            return "DANGER";
        } else if (score >= config.getWarningThreshold()) {
            return "WARNING";
        } else {
            return "NORMAL";
        }
    }

    // -------------------------
    // 7. anomaly 조회 (핵심)
    // -------------------------
    public List<MotorAnomalyResponse> getAnomalies(Long equipmentId) {

        List<MotorAnomalyResult> resultList =
                motorAnomalyResultRepository.findByEquipmentId(equipmentId);

        return resultList.stream()
                .map(result -> {

                    AnomalyConfig config = anomalyConfigRepository
                            .findById(result.getConfigId())
                            .orElseThrow(IllegalArgumentException::new);

                    String severity = calculateSeverity(
                            result.getAnomalyScore(),
                            config
                    );

                    return MotorAnomalyResponse.from(result, severity);
                })
                .toList();
    }
    /**
     * 특정 anomaly 결과에 대한 센서 기여도 목록을 조회한다.
     *
     * @param anomalyResultId anomaly 결과 ID
     * @return 기여도 리스트
     */
    public List<MotorAnomalyContributionResponse> getContributions(Long anomalyResultId) {

        List<MotorAnomalySensorContribution> contributions =
                motorAnomalySensorContributionRepository
                        .findByMotorAnomalyResultIdOrderByContributionRankAsc(anomalyResultId);

        return contributions.stream()
                .map(c -> {

                    String displayName = sensorDisplayNameMap.getOrDefault(
                            c.getSensorTag(),
                            c.getSensorTag()
                    );

                    return MotorAnomalyContributionResponse.from(
                            c,
                            displayName
                    );
                })
                .toList();
    }
}