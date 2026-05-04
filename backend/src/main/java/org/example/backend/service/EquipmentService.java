package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.domain.anomaly.AnomalyConfig;
import org.example.backend.domain.anomaly.MotorAnomalyResult;
import org.example.backend.domain.anomaly.MotorAnomalySensorContribution;
import org.example.backend.domain.equipment.Equipment;
import org.example.backend.domain.sensor.MotorSensorData;
import org.example.backend.domain.sensor.MotorSensorThreshold;
import org.example.backend.domain.sensor.TubeSensorData;
import org.example.backend.domain.sensor.TubeSensorThreshold;
import org.example.backend.dto.response.*;
import org.example.backend.global.enums.EquipmentType;
import org.example.backend.repository.*;
import org.springframework.stereotype.Service;
import org.example.backend.domain.anomaly.TubeAnomalyResult;
import org.example.backend.domain.anomaly.TubeAnomalySensorContribution;
import org.example.backend.dto.response.TubeAnomalyContributionResponse;
import org.example.backend.repository.TubeAnomalySensorContributionRepository;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EquipmentService {

    private final TubeSensorThresholdRepository tubeSensorThresholdRepository;
    private final EquipmentRepository equipmentRepository;
    private final MotorSensorDataRepository motorSensorDataRepository;
    private final TubeSensorDataRepository tubeSensorDataRepository;
    private final MotorSensorThresholdRepository motorSensorThresholdRepository;
    private final MotorAnomalyResultRepository motorAnomalyResultRepository;
    private final AnomalyConfigRepository anomalyConfigRepository;
    private final MotorAnomalySensorContributionRepository motorAnomalySensorContributionRepository;
    private final TubeAnomalyResultRepository tubeAnomalyResultRepository;
    private final TubeAnomalySensorContributionRepository tubeAnomalySensorContributionRepository;
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
    // 4. 센서 데이터 조회 (motor/tube 분기)
    // -------------------------
    public List<?> getSensorData(Long equipmentId) {

        Equipment equipment = equipmentRepository.findById(equipmentId)
                .orElseThrow(() -> new IllegalArgumentException("해당 설비가 존재하지 않습니다."));

        if (equipment.getEquipmentType() == EquipmentType.MOTOR) {

            List<MotorSensorData> sensorDataList =
                    motorSensorDataRepository.findByEquipmentId(equipmentId);

            return sensorDataList.stream()
                    .map(MotorSensorDataResponse::from)
                    .toList();

        } else {

            List<TubeSensorData> sensorDataList =
                    tubeSensorDataRepository.findByEquipmentId(equipmentId);

            return sensorDataList.stream()
                    .map(TubeSensorDataResponse::from)
                    .toList();
        }
    }

    /**
     * 특정 설비의 센서 임계값 목록을 조회한다.
     */
    /**
     * 특정 설비의 센서 임계값 목록을 조회한다.
     */
    public List<SensorThresholdResponse> getSensorThresholds(Long equipmentId) {

        Equipment equipment = equipmentRepository.findById(equipmentId)
                .orElseThrow(() -> new IllegalArgumentException("해당 설비가 존재하지 않습니다."));

        AnomalyConfig config = anomalyConfigRepository
                .findByEquipmentTypeAndIsActiveTrue(equipment.getEquipmentType())
                .orElseThrow(() -> new IllegalArgumentException("활성화된 이상 판단 기준이 존재하지 않습니다."));

        if (equipment.getEquipmentType() == EquipmentType.MOTOR) {
            return motorSensorThresholdRepository.findByConfigId(config.getConfigId())
                    .stream()
                    .map(threshold -> SensorThresholdResponse.builder()
                            .equipmentType(equipment.getEquipmentType().name())
                            .sensorTag(threshold.getSensorTag())
                            .displayName(sensorDisplayNameMap.getOrDefault(
                                    threshold.getSensorTag(),
                                    threshold.getSensorTag()
                            ))
                            .lowerThreshold(threshold.getLowerThreshold())
                            .upperThreshold(threshold.getUpperThreshold())
                            .build())
                    .toList();
        }

        return tubeSensorThresholdRepository.findByConfigId(config.getConfigId())
                .stream()
                .map(threshold -> SensorThresholdResponse.builder()
                        .equipmentType(equipment.getEquipmentType().name())
                        .sensorTag(threshold.getSensorTag())
                        .displayName(sensorDisplayNameMap.getOrDefault(
                                threshold.getSensorTag(),
                                threshold.getSensorTag()
                        ))
                        .lowerThreshold(threshold.getLowerThreshold())
                        .upperThreshold(threshold.getUpperThreshold())
                        .build())
                .toList();

    }

    // -------------------------
    // severity 계산
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
    // anomaly 조회
    // -------------------------
    /**
     * 특정 설비의 이상 탐지 결과를 조회한다.
     */
    public List<?> getAnomalies(Long equipmentId) {

        Equipment equipment = equipmentRepository.findById(equipmentId)
                .orElseThrow(() -> new IllegalArgumentException("해당 설비가 존재하지 않습니다."));

        if (equipment.getEquipmentType() == EquipmentType.MOTOR) {

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

        } else {

            List<TubeAnomalyResult> resultList =
                    tubeAnomalyResultRepository.findByEquipmentId(equipmentId);

            return resultList.stream()
                    .map(result -> {
                        AnomalyConfig config = anomalyConfigRepository
                                .findById(result.getConfigId())
                                .orElseThrow(IllegalArgumentException::new);

                        String severity = calculateSeverity(
                                result.getAnomalyScore(),
                                config
                        );

                        return TubeAnomalyResponse.from(result, severity);
                    })
                    .toList();
        }
    }

    /**
     * 특정 anomaly 결과에 대한 센서 기여도 목록 조회
     */
    public List<?> getContributions(Long anomalyResultId) {

        // MOTOR 먼저 조회
        List<MotorAnomalySensorContribution> motorList =
                motorAnomalySensorContributionRepository
                        .findByMotorAnomalyResultIdOrderByContributionRankAsc(anomalyResultId);

        if (!motorList.isEmpty()) {

            return motorList.stream()
                    .map(c -> {
                        String displayName = sensorDisplayNameMap.getOrDefault(
                                c.getSensorTag(),
                                c.getSensorTag()
                        );

                        return MotorAnomalyContributionResponse.from(c, displayName);
                    })
                    .toList();
        }

        // 없으면 TUBE 조회
        List<TubeAnomalySensorContribution> tubeList =
                tubeAnomalySensorContributionRepository
                        .findByTubeAnomalyResultIdOrderByContributionRankAsc(anomalyResultId);

        return tubeList.stream()
                .map(c -> {
                    String displayName = sensorDisplayNameMap.getOrDefault(
                            c.getSensorTag(),
                            c.getSensorTag()
                    );

                    return TubeAnomalyContributionResponse.from(c, displayName);
                })
                .toList();
    }/**
     * 특정 anomaly 결과에 대한 센서 기여도 목록 조회
     */
    public List<?> getContributions(Long equipmentId, Long anomalyResultId) {

        Equipment equipment = equipmentRepository.findById(equipmentId)
                .orElseThrow(() -> new IllegalArgumentException("해당 설비가 존재하지 않습니다."));

        if (equipment.getEquipmentType() == EquipmentType.MOTOR) {

            List<MotorAnomalySensorContribution> contributions =
                    motorAnomalySensorContributionRepository
                            .findByMotorAnomalyResultIdOrderByContributionRankAsc(anomalyResultId);

            return contributions.stream()
                    .map(c -> {
                        String displayName = sensorDisplayNameMap.getOrDefault(
                                c.getSensorTag(),
                                c.getSensorTag()
                        );

                        return MotorAnomalyContributionResponse.from(c, displayName);
                    })
                    .toList();
        }

        List<TubeAnomalySensorContribution> contributions =
                tubeAnomalySensorContributionRepository
                        .findByTubeAnomalyResultIdOrderByContributionRankAsc(anomalyResultId);

        return contributions.stream()
                .map(c -> {
                    String displayName = sensorDisplayNameMap.getOrDefault(
                            c.getSensorTag(),
                            c.getSensorTag()
                    );

                    return TubeAnomalyContributionResponse.from(c, displayName);
                })
                .toList();
    }
}