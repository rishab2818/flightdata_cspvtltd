import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthContext } from "../../../context/AuthContext";
import {
  getPendingAcknowledgements,
  taskAcknowledgementsApi,
} from "../api/taskAcknowledgementsApi";
import TaskAcknowledgementToasts from "../components/TaskAcknowledgementToasts";

const TaskAcknowledgementContext = createContext(null);
const PENDING_ACKNOWLEDGEMENT_LIMIT = 10;

export function TaskAcknowledgementProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const [pendingAcknowledgements, setPendingAcknowledgements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingIds, setPendingIds] = useState({});

  const loadPendingAcknowledgements = useCallback(async () => {
    if (!isAuthenticated) {
      setPendingAcknowledgements([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getPendingAcknowledgements(PENDING_ACKNOWLEDGEMENT_LIMIT);
      setPendingAcknowledgements(data || []);
    } catch (err) {
      console.error("Failed to load task acknowledgements", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const refreshPendingAcknowledgements = useCallback(
    () => loadPendingAcknowledgements(),
    [loadPendingAcknowledgements]
  );

  useEffect(() => {
    loadPendingAcknowledgements();
  }, [loadPendingAcknowledgements]);

  const acknowledge = useCallback(async (acknowledgementId) => {
    if (!acknowledgementId) {
      return;
    }

    setPendingIds((prev) => ({ ...prev, [acknowledgementId]: true }));
    try {
      await taskAcknowledgementsApi.acknowledge(acknowledgementId);
      setPendingAcknowledgements((prev) =>
        prev.filter((item) => item.id !== acknowledgementId)
      );
      await refreshPendingAcknowledgements();
    } catch (err) {
      console.error("Failed to acknowledge task item", err);
    } finally {
      setPendingIds((prev) => {
        const next = { ...prev };
        delete next[acknowledgementId];
        return next;
      });
    }
  }, [refreshPendingAcknowledgements]);

  const value = useMemo(
    () => ({
      items: pendingAcknowledgements,
      pendingAcknowledgements,
      loading,
      error,
      pendingIds,
      loadPendingAcknowledgements,
      refresh: refreshPendingAcknowledgements,
      refreshPendingAcknowledgements,
      acknowledge,
    }),
    [
      pendingAcknowledgements,
      loading,
      error,
      pendingIds,
      loadPendingAcknowledgements,
      refreshPendingAcknowledgements,
      acknowledge,
    ]
  );

  return (
    <TaskAcknowledgementContext.Provider value={value}>
      {children}
      <TaskAcknowledgementToasts />
    </TaskAcknowledgementContext.Provider>
  );
}

export function useTaskAcknowledgements() {
  return useContext(TaskAcknowledgementContext);
}
