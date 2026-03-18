import React, { createContext, useContext, useMemo, useState } from "react";
import CircularLoader from "../components/common/CircularLoader";

const LoaderContext = createContext(null);

export function LoaderProvider({ children }) {
  const [loader, setLoader] = useState({
    visible: false,
    message: "Processing...",
  });

  const showLoader = (message = "Processing...") => {
    setLoader({ visible: true, message });
  };

  const hideLoader = () => {
    setLoader((prev) => ({ ...prev, visible: false }));
  };

  const value = useMemo(
    () => ({
      showLoader,
      hideLoader,
      loader,
    }),
    [loader]
  );

  return (
    <LoaderContext.Provider value={value}>
      {children}
      <CircularLoader visible={loader.visible} message={loader.message} />
    </LoaderContext.Provider>
  );
}

export function useLoader() {
  const context = useContext(LoaderContext);
  if (!context) {
    throw new Error("useLoader must be used inside LoaderProvider");
  }
  return context;
}