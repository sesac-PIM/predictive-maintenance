package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.response.EquipmentResponse;
import org.example.backend.repository.EquipmentRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EquipmentService {

    private final EquipmentRepository equipmentRepository;

    public List<EquipmentResponse> getEquipments() {
        return equipmentRepository.findAll()
                .stream()
                .map(EquipmentResponse::from)
                .toList();
    }
}