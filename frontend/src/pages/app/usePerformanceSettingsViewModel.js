import { useCallback, useEffect, useMemo, useState } from "react";

import {
  calculateCycleEndDatePreview,
  performanceSettingsService,
} from "../../api/performanceSettings.service";

const DEFAULT_FREQUENCIES = ["monthly", "quarterly", "half_yearly", "yearly"];

function formatFrequency(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function usePerformanceSettingsViewModel() {
  const [frequency, setFrequency] = useState("");
  const [firstCycleStartDate, setFirstCycleStartDate] = useState("");
  const [firstCycleEndDate, setFirstCycleEndDate] = useState("");
  const [currentCycle, setCurrentCycle] = useState(null);
  const [availableFrequencies, setAvailableFrequencies] = useState(DEFAULT_FREQUENCIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const applySettings = useCallback((settings) => {
    setFrequency(settings?.frequency || "");
    setFirstCycleStartDate(settings?.first_cycle_start_date || "");
    setFirstCycleEndDate(settings?.first_cycle_end_date || "");
    setCurrentCycle(settings?.current_cycle || null);
    setAvailableFrequencies(
      settings?.available_frequencies?.length
        ? settings.available_frequencies
        : DEFAULT_FREQUENCIES
    );
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await performanceSettingsService.get();
      applySettings(settings);
      setIsError(false);
    } catch {
      setIsError(true);
      setMessage("Unable to load performance settings.");
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setFirstCycleEndDate(
      calculateCycleEndDatePreview(firstCycleStartDate, frequency)
    );
  }, [firstCycleStartDate, frequency]);

  const frequencyOptions = useMemo(
    () =>
      availableFrequencies.map((value) => ({
        value,
        label: formatFrequency(value),
      })),
    [availableFrequencies]
  );

  const saveSettings = useCallback(
    async (event) => {
      event.preventDefault();
      if (!frequency || !firstCycleStartDate) {
        setIsError(true);
        setMessage("Evaluation Frequency and First Cycle Start Date are required.");
        return;
      }

      setSaving(true);
      setMessage("");
      try {
        await performanceSettingsService.save({
          frequency,
          first_cycle_start_date: firstCycleStartDate,
        });
        const persisted = await performanceSettingsService.get();
        applySettings(persisted);
        setIsError(false);
        setMessage("Performance settings saved successfully.");
      } catch (error) {
        setIsError(true);
        setMessage(
          error?.response?.data?.detail || "Unable to save performance settings."
        );
      } finally {
        setSaving(false);
      }
    },
    [applySettings, firstCycleStartDate, frequency]
  );

  return {
    currentCycle,
    firstCycleEndDate,
    firstCycleStartDate,
    frequency,
    frequencyOptions,
    isError,
    loading,
    message,
    saving,
    saveSettings,
    setFirstCycleStartDate,
    setFrequency,
  };
}
