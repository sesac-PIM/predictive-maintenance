package org.example.backend.global.mapper;

import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class SensorNameMapper {

    private static final Map<String, String> SENSOR_NAME_MAP = Map.ofEntries(
            // MOTOR - MAC_A
            Map.entry("ii1211a", "MAC_A 전류"),
            Map.entry("tt1228a", "MAC_A NDE 베어링 온도"),
            Map.entry("yi1593aa", "MAC_A NDE 베어링 진동 1"),
            Map.entry("tt1227a", "MAC_A DE 베어링 온도"),
            Map.entry("yi1593ab", "MAC_A DE 베어링 진동 1"),
            Map.entry("yi1594aa", "MAC_A NDE 베어링 진동 2"),
            Map.entry("yi1594ab", "MAC_A DE 베어링 진동 2"),

            // MOTOR - MAC_B
            Map.entry("ii1211b", "MAC_B 전류"),
            Map.entry("tt1228b", "MAC_B NDE 베어링 온도"),
            Map.entry("yi1593ba", "MAC_B NDE 베어링 진동 1"),
            Map.entry("tt1227b", "MAC_B DE 베어링 온도"),
            Map.entry("yi1593bb", "MAC_B DE 베어링 진동 1"),
            Map.entry("yi1594ba", "MAC_B NDE 베어링 진동 2"),
            Map.entry("yi1594bb", "MAC_B DE 베어링 진동 2"),

            // MOTOR - BAC
            Map.entry("ii1442", "BAC 전류"),
            Map.entry("tt1427", "BAC NDE 베어링 온도"),
            Map.entry("yi1483a", "BAC NDE 베어링 진동 1"),
            Map.entry("tt1428", "BAC DE 베어링 온도"),
            Map.entry("yi1483b", "BAC DE 베어링 진동 1"),
            Map.entry("yi1484a", "BAC NDE 베어링 진동 2"),
            Map.entry("yi1484b", "BAC DE 베어링 진동 2"),

            // MOTOR - DGAN
            Map.entry("ii7140", "DGAN 전류"),
            Map.entry("tt7111", "DGAN NDE 베어링 온도"),
            Map.entry("yi7364a", "DGAN NDE 베어링 진동 1"),
            Map.entry("tt7100", "DGAN DE 베어링 온도"),
            Map.entry("yi7364b", "DGAN DE 베어링 진동 1"),
            Map.entry("yi7365a", "DGAN NDE 베어링 진동 2"),
            Map.entry("yi7365b", "DGAN DE 베어링 진동 2"),

            // MOTOR - VHP
            Map.entry("ii7145", "VHP 전류"),
            Map.entry("tt7152", "VHP NDE 베어링 온도"),
            Map.entry("yi7358a", "VHP NDE 베어링 진동 1"),
            Map.entry("tt7151", "VHP DE 베어링 온도"),
            Map.entry("yi7358b", "VHP DE 베어링 진동 1"),
            Map.entry("yi7359a", "VHP NDE 베어링 진동 2"),
            Map.entry("yi7359b", "VHP DE 베어링 진동 2"),

            // TUBE
            Map.entry("tag_13tt0064", "합성가스 쿨러 출구측 온도"),
            Map.entry("tag_15pdt0002a", "석탄재 필터 압력 차"),
            Map.entry("tag_13pdt0067", "가스화기 내부 압력 차"),
            Map.entry("tag_13fi0044", "메인 스팀 배출량"),
            Map.entry("tag_13ffyc0046", "메인 스팀 급수 유량"),
            Map.entry("tag_13fy0045", "중압 수분 스팀 밸런스"),
            Map.entry("tag_13jyi9001", "가스화기 열부하"),
            Map.entry("tag_10ind0001", "가스화기 부하율"),
            Map.entry("bopc1_1_16200_fi_po041", "외부 급수 유입량")
    );

    public String getDisplayName(String sensorTag) {
        return SENSOR_NAME_MAP.getOrDefault(sensorTag, sensorTag);
    }
}