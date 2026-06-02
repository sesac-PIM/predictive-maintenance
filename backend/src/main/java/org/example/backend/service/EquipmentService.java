package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.domain.anomaly.AnomalyConfig;
import org.example.backend.domain.anomaly.MotorAnomalyResult;
import org.example.backend.domain.equipment.Equipment;
import org.example.backend.domain.sensor.MotorSensorData;
import org.example.backend.domain.sensor.TubeSensorData;
import org.example.backend.dto.response.*;
import org.example.backend.global.enums.EquipmentType;
import org.example.backend.global.exception.CustomException;
import org.example.backend.global.exception.ErrorCode;
import org.example.backend.global.mapper.SensorNameMapper;
import org.example.backend.repository.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EquipmentService {

    private static final int DEFAULT_SENSOR_DATA_LIMIT = 300;
    private static final int DEFAULT_ANOMALY_LIMIT = 300;
    private static final int MAX_QUERY_LIMIT = 1000;

    private final EquipmentRepository equipmentRepository;
    private final MotorSensorDataRepository motorSensorDataRepository;
    private final TubeSensorDataRepository tubeSensorDataRepository;
    private final MotorSensorThresholdRepository motorSensorThresholdRepository;
    private final TubeSensorThresholdRepository tubeSensorThresholdRepository;
    private final MotorAnomalyResultRepository motorAnomalyResultRepository;
    private final TubeAnomalyResultRepository tubeAnomalyResultRepository;
    private final AnomalyConfigRepository anomalyConfigRepository;
    private final MotorAnomalySensorContributionRepository motorAnomalySensorContributionRepository;
    private final TubeAnomalySensorContributionRepository tubeAnomalySensorContributionRepository;
    private final SensorNameMapper sensorNameMapper;

    public List<EquipmentResponse> getEquipments(Long plantId) {
        if (plantId != null) {
            return equipmentRepository.findByPlant_PlantId(plantId)
                    .stream()
                    .map(EquipmentResponse::from)
                    .toList();
        }

        return equipmentRepository.findAll()
                .stream()
                .map(EquipmentResponse::from)
                .toList();
    }

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

    public EquipmentResponse getEquipment(Long equipmentId) {
        return equipmentRepository.findById(equipmentId)
                .map(EquipmentResponse::from)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));
    }

    public List<?> getSensorData(Long equipmentId, Integer limit) {
        Equipment equipment = findEquipment(equipmentId);
        PageRequest pageRequest = PageRequest.of(
                0,
                normalizeLimit(limit, DEFAULT_SENSOR_DATA_LIMIT, MAX_QUERY_LIMIT)
        );

        if (equipment.getEquipmentType() == EquipmentType.MOTOR) {
            List<MotorSensorData> sensorDataList =
                    motorSensorDataRepository.findByEquipmentIdOrderByMeasuredAtDesc(
                            equipmentId,
                            pageRequest
                    );

            return sensorDataList.stream()
                    .map(MotorSensorDataResponse::from)
                    .toList();
        }

        List<TubeSensorData> sensorDataList =
                tubeSensorDataRepository.findByEquipmentIdOrderByMeasuredAtDesc(
                        equipmentId,
                        pageRequest
                );

        return sensorDataList.stream()
                .map(TubeSensorDataResponse::from)
                .toList();
    }

    public List<SensorThresholdResponse> getSensorThresholds(Long equipmentId) {
        Equipment equipment = findEquipment(equipmentId);

        AnomalyConfig config = anomalyConfigRepository
                .findByEquipmentTypeAndIsActiveTrue(
                        equipment.getEquipmentType()
                )
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));

        if (equipment.getEquipmentType() == EquipmentType.MOTOR) {
            return motorSensorThresholdRepository
                    .findLatestByEquipmentIdAndConfigId(
                            equipmentId,
                            config.getConfigId()
                    )
                    .stream()
                    .map(threshold -> SensorThresholdResponse.builder()
                            .equipmentType(equipment.getEquipmentType().name())
                            .sensorTag(threshold.getSensorTag())
                            .displayName(
                                    sensorNameMapper.getDisplayName(
                                            threshold.getSensorTag()
                                    )
                            )
                            .windowStartAt(threshold.getWindowStartAt())
                            .windowEndAt(threshold.getWindowEndAt())
                            .lowerThreshold(threshold.getLowerThreshold())
                            .upperThreshold(threshold.getUpperThreshold())
                            .build())
                    .toList();
        }

        return tubeSensorThresholdRepository
                .findLatestByEquipmentIdAndConfigId(
                        equipmentId,
                        config.getConfigId()
                )
                .stream()
                .map(threshold -> SensorThresholdResponse.builder()
                        .equipmentType(equipment.getEquipmentType().name())
                        .sensorTag(threshold.getSensorTag())
                        .displayName(
                                sensorNameMapper.getDisplayName(
                                        threshold.getSensorTag()
                                )
                        )
                        .windowStartAt(threshold.getWindowStartAt())
                        .windowEndAt(threshold.getWindowEndAt())
                        .lowerThreshold(threshold.getLowerThreshold())
                        .upperThreshold(threshold.getUpperThreshold())
                        .build())
                .toList();
    }

    public List<?> getAnomalies(Long equipmentId, String component, Integer limit) {
        Equipment equipment = findEquipment(equipmentId);
        PageRequest pageRequest = PageRequest.of(
                0,
                normalizeLimit(limit, DEFAULT_ANOMALY_LIMIT, MAX_QUERY_LIMIT)
        );

        if (equipment.getEquipmentType() == EquipmentType.MOTOR) {
            String componentName = normalizeMotorComponent(component);
            List<MotorAnomalyResult> results = componentName == null
                    ? motorAnomalyResultRepository.findByEquipmentIdOrderByMeasuredAtDesc(
                            equipmentId,
                            pageRequest
                    )
                    : motorAnomalyResultRepository.findByEquipmentIdAndComponentNameOrderByMeasuredAtDesc(
                            equipmentId,
                            componentName,
                            pageRequest
                    );

            return results
                    .stream()
                    .map(result -> {
                        AnomalyConfig config = findConfig(result.getConfigId());
                        String severity = calculateSeverity(
                                result.getAnomalyScore(),
                                config
                        );

                        return MotorAnomalyResponse.builder()
                                .equipmentType(equipment.getEquipmentType().name())
                                .componentName(result.getComponentName())
                                .anomalyResultId(result.getMotorAnomalyResultId())
                                .measuredAt(result.getMeasuredAt())
                                .anomalyScore(result.getAnomalyScore())
                                .severity(severity)
                                .eventType(result.getEventType())
                                .durationSec(result.getDurationSec())
                                .description(result.getDescription())
                                .build();
                    })
                    .toList();
        }

        return tubeAnomalyResultRepository.findByEquipmentIdOrderByMeasuredAtDesc(
                        equipmentId,
                        pageRequest
                )
                .stream()
                .map(result -> {
                    AnomalyConfig config = findConfig(result.getConfigId());
                    String severity = calculateSeverity(
                            result.getAnomalyScore(),
                            config
                    );

                    return TubeAnomalyResponse.builder()
                            .equipmentType(equipment.getEquipmentType().name())
                            .anomalyResultId(result.getTubeAnomalyResultId())
                            .measuredAt(result.getMeasuredAt())
                            .anomalyScore(result.getAnomalyScore())
                            .severity(severity)
                            .build();
                })
                .toList();
    }

    public List<ContributionResponse> getContributions(
            Long equipmentId,
            Long anomalyResultId
    ) {
        Equipment equipment = findEquipment(equipmentId);

        if (equipment.getEquipmentType() == EquipmentType.MOTOR) {
            return motorAnomalySensorContributionRepository
                    .findByMotorAnomalyResultIdOrderByContributionRankAsc(
                            anomalyResultId
                    )
                    .stream()
                    .map(contribution -> ContributionResponse.builder()
                            .equipmentType(equipment.getEquipmentType().name())
                            .sensorTag(contribution.getSensorTag())
                            .displayName(
                                    sensorNameMapper.getDisplayName(
                                            contribution.getSensorTag()
                                    )
                            )
                            .sensorValue(contribution.getSensorValue())
                            .contributionScore(contribution.getContributionScore())
                            .contributionRank(contribution.getContributionRank())
                            .build())
                    .toList();
        }

        return tubeAnomalySensorContributionRepository
                .findByTubeAnomalyResultIdOrderByContributionRankAsc(
                        anomalyResultId
                )
                .stream()
                .map(contribution -> ContributionResponse.builder()
                        .equipmentType(equipment.getEquipmentType().name())
                        .sensorTag(contribution.getSensorTag())
                        .displayName(
                                sensorNameMapper.getDisplayName(
                                        contribution.getSensorTag()
                                )
                        )
                        .sensorValue(contribution.getSensorValue())
                        .contributionScore(contribution.getContributionScore())
                        .contributionRank(contribution.getContributionRank())
                        .build())
                .toList();
    }

    private Equipment findEquipment(Long equipmentId) {
        return equipmentRepository.findById(equipmentId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));
    }

    private AnomalyConfig findConfig(Long configId) {
        return anomalyConfigRepository.findById(configId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));
    }

    private String calculateSeverity(Double score, AnomalyConfig config) {
        if (score >= config.getDangerThreshold()) {
            return "DANGER";
        }

        if (score >= config.getWarningThreshold()) {
            return "WARNING";
        }

        return "NORMAL";
    }

    private String normalizeMotorComponent(String component) {
        if (component == null || component.isBlank()) {
            return null;
        }

        return component.trim().toUpperCase().replace('-', '_').replace(' ', '_');
    }

    private int normalizeLimit(Integer limit, int defaultValue, int maxValue) {
        if (limit == null || limit <= 0) {
            return defaultValue;
        }

        return Math.min(limit, maxValue);
    }
}
