package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.domain.anomaly.MotorAnomalyResult;
import org.example.backend.domain.anomaly.TubeAnomalyResult;
import org.example.backend.repository.MotorAnomalyResultRepository;
import org.example.backend.repository.TubeAnomalyResultRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AlertProcessingScheduler {

    private final MotorAnomalyResultRepository motorAnomalyResultRepository;
    private final TubeAnomalyResultRepository tubeAnomalyResultRepository;
    private final AlertService alertService;
    private final RealtimeEventService realtimeEventService;

    @Scheduled(fixedDelayString = "${app.alert-processor.delay-ms:5000}")
    @Transactional
    public void processPendingResults() {
        boolean processedAny = false;
        boolean alertChanged = false;

        List<MotorAnomalyResult> motorResults =
                motorAnomalyResultRepository.findTop100ByAlertProcessedFalseOrderByMotorAnomalyResultIdAsc();
        for (MotorAnomalyResult result : motorResults) {
            alertChanged = alertService.processMotorResult(result) || alertChanged;
            result.markAlertProcessed();
            processedAny = true;
        }

        List<TubeAnomalyResult> tubeResults =
                tubeAnomalyResultRepository.findTop100ByAlertProcessedFalseOrderByTubeAnomalyResultIdAsc();
        for (TubeAnomalyResult result : tubeResults) {
            alertChanged = alertService.processTubeResult(result) || alertChanged;
            result.markAlertProcessed();
            processedAny = true;
        }

        if (processedAny) {
            realtimeEventService.publish("ANOMALY_UPDATED");
        }
        if (alertChanged) {
            realtimeEventService.publish("ALERT_UPDATED");
        }
    }
}
