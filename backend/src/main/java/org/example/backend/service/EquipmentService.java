package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.response.EquipmentResponse;
import org.example.backend.dto.response.EquipmentSummaryResponse;
import org.example.backend.repository.EquipmentRepository;
import org.springframework.stereotype.Service;
import org.example.backend.domain.sensor.MotorSensorData;
import org.example.backend.dto.response.MotorSensorDataResponse;
import org.example.backend.repository.MotorSensorDataRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EquipmentService {

    private final EquipmentRepository equipmentRepository;
    private final MotorSensorDataRepository motorSensorDataRepository;

    // 기존 API
    public List<EquipmentResponse> getEquipments() {
        return equipmentRepository.findAll()
                .stream()
                .map(EquipmentResponse::from)
                .toList();
    }

    // summary API
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

    // 상세조회 API
    public EquipmentResponse getEquipment(Long equipmentId) {
        return equipmentRepository.findById(equipmentId)
                .map(EquipmentResponse::from)
                .orElseThrow(() -> new IllegalArgumentException("해당 설비가 존재하지 않습니다."));
    }
    // 특정 설비의 센서데이터 조회
    public List<MotorSensorDataResponse> getSensorData(Long equipmentId) {

        List<MotorSensorData> sensorDataList =
                motorSensorDataRepository.findByEquipmentId(equipmentId);

        return sensorDataList.stream()
                .map(MotorSensorDataResponse::from)
                .toList();
    }
}