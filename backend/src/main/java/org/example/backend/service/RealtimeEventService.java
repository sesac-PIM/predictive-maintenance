package org.example.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class RealtimeEventService {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(error -> emitters.remove(emitter));

        publishToEmitter(emitter, "CONNECTED");
        return emitter;
    }

    public void publish(String eventType) {
        for (SseEmitter emitter : emitters) {
            publishToEmitter(emitter, eventType);
        }
    }

    private void publishToEmitter(SseEmitter emitter, String eventType) {
        try {
            emitter.send(SseEmitter.event()
                    .name("realtime-update")
                    .data(eventType));
        } catch (IOException | IllegalStateException e) {
            emitters.remove(emitter);
        }
    }
}
