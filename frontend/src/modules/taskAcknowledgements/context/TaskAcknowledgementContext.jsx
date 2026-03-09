import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthContext } from "../../../context/AuthContext";
import { taskAcknowledgementsApi } from "../api/taskAcknowledgementsApi";
import TaskAcknowledgementToasts from "../components/TaskAcknowledgementToasts";

const TaskAcknowledgementContext = createContext(null);

export function TaskAcknowledgementProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingIds, setPendingIds] = useState({});

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      const data = await taskAcknowledgementsApi.listPending(10);
      setItems(data || []);
    } catch (err) {
      console.error("Failed to load task acknowledgements", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
    if (!isAuthenticated) {
      return undefined;
    }

    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [isAuthenticated, refresh]);

  const acknowledge = useCallback(async (acknowledgementId) => {
    if (!acknowledgementId) {
      return;
    }

    setPendingIds((prev) => ({ ...prev, [acknowledgementId]: true }));
    try {
      await taskAcknowledgementsApi.acknowledge(acknowledgementId);
      setItems((prev) => prev.filter((item) => item.id !== acknowledgementId));
      await refresh();
    } catch (err) {
      console.error("Failed to acknowledge task item", err);
    } finally {
      setPendingIds((prev) => {
        const next = { ...prev };
        delete next[acknowledgementId];
        return next;
      });
    }
  }, [refresh]);

  const value = useMemo(
    () => ({
      items,
      loading,
      pendingIds,
      refresh,
      acknowledge,
    }),
    [items, loading, pendingIds, refresh, acknowledge]
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
