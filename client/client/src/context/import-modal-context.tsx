import { createContext, useContext, useState } from "react";

interface ImportModalContextType {
  open: boolean;
  openImport: () => void;
  closeImport: () => void;
}

const ImportModalContext = createContext<ImportModalContextType>({
  open: false,
  openImport: () => {},
  closeImport: () => {},
});

export function ImportModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ImportModalContext.Provider
      value={{
        open,
        openImport: () => setOpen(true),
        closeImport: () => setOpen(false),
      }}
    >
      {children}
    </ImportModalContext.Provider>
  );
}

export function useImportModal() {
  return useContext(ImportModalContext);
}
