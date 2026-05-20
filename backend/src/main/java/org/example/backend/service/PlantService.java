package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.response.PlantResponse;
import org.example.backend.repository.PlantRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PlantService {

    private final PlantRepository plantRepository;

    public List<PlantResponse> getPlants() {
        return plantRepository.findAll()
                .stream()
                .map(PlantResponse::from)
                .toList();
    }
}