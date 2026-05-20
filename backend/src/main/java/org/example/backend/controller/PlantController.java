package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.response.PlantResponse;
import org.example.backend.service.PlantService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/plants")
@RequiredArgsConstructor
public class PlantController {

    private final PlantService plantService;

    @GetMapping
    public List<PlantResponse> getPlants() {
        return plantService.getPlants();
    }
}