package org.example.backend.controller;

import org.example.backend.dto.response.*;
import lombok.RequiredArgsConstructor;
import org.example.backend.service.EquipmentService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    public List<?> getSensorData(@PathVariable Long equipmentId) {
        return equipmentService.getSensorData(equipmentId);
    }

    @GetMapping("/{equipmentId}/sensor-thresholds")
    public List<SensorThresholdResponse> getSensorThresholds(@PathVariable Long equipmentId) {
        return equipmentService.getSensorThresholds(equipmentId);
    }

    @GetMapping("/{equipmentId}/anomalies")
    public List<AnomalyResponse> getAnomalies(@PathVariable Long equipmentId) {
        return equipmentService.getAnomalies(equipmentId);
    }

    @GetMapping("/{equipmentId}/anomalies/{anomalyResultId}/contributions")
    public List<ContributionResponse> getContributions(
            @PathVariable Long equipmentId,
            @PathVariable Long anomalyResultId
    ) {
        return equipmentService.getContributions(equipmentId, anomalyResultId);
    }
}