package org.example.backend.controller;

import org.example.backend.dto.response.MotorSensorThresholdResponse;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.response.EquipmentResponse;
import org.example.backend.dto.response.EquipmentSummaryResponse;
import org.example.backend.dto.response.MotorSensorDataResponse;
import org.example.backend.service.EquipmentService;
import org.springframework.web.bind.annotation.*;
import org.example.backend.dto.response.MotorAnomalyResponse;
import java.util.List;
import org.example.backend.dto.response.MotorAnomalyContributionResponse;

@RestController
@RequestMapping("/api/equipments")
@RequiredArgsConstructor
public class EquipmentController {

    private final EquipmentService equipmentService;

    @GetMapping
    public List<EquipmentResponse> getEquipments() {
        return equipmentService.getEquipments();
    }

    @GetMapping("/summary")
    public EquipmentSummaryResponse getSummary() {
        return equipmentService.getEquipmentSummary();
    }

    @GetMapping("/{equipmentId}")
    public EquipmentResponse getEquipment(@PathVariable Long equipmentId) {
        return equipmentService.getEquipment(equipmentId);
    }

    @GetMapping("/{equipmentId}/sensor-data")
    public List<MotorSensorDataResponse> getSensorData(@PathVariable Long equipmentId) {
        return equipmentService.getSensorData(equipmentId);
    }

    @GetMapping("/{equipmentId}/sensor-thresholds")
    public List<MotorSensorThresholdResponse> getSensorThresholds(@PathVariable Long equipmentId) {
        return equipmentService.getSensorThresholds(1L);
    }

    @GetMapping("/{equipmentId}/anomalies")
    public List<MotorAnomalyResponse> getAnomalies(@PathVariable Long equipmentId) {
        return equipmentService.getAnomalies(equipmentId);
    }

    @GetMapping("/{equipmentId}/anomalies/{anomalyResultId}/contributions")
    public List<MotorAnomalyContributionResponse> getContributions(
            @PathVariable Long equipmentId,
            @PathVariable Long anomalyResultId
    ) {
        return equipmentService.getContributions(anomalyResultId);
    }
}