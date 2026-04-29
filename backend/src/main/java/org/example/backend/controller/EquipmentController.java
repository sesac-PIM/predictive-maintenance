package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.response.EquipmentResponse;
import org.example.backend.dto.response.EquipmentSummaryResponse;
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
}