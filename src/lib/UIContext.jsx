import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toastMsg, setToastMsg] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const [modal, setModal] = useState(null); // { title, body }
  const timer = useRef();

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setToastOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastOn(false), 2200);
  }, []);
  const openModal = useCallback((title, body) => setModal({ title, body }), []);
  const closeModal = useCallback(() => setModal(null), []);
  const confirm = useCallback((title, message, onYes, label = "Delete") =>
    setModal({
      title,
      body: (
        <>
          <p style={{ margin: "0 0 20px", color: "#55535b", lineHeight: 1.5 }}>{message}</p>
          <div className="form-actions">
            <button className="btn light" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn danger" onClick={() => { setModal(null); onYes(); }}>{label}</button>
          </div>
        </>
      ),
    }), []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setModal(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <UIContext.Provider value={{ toast, openModal, closeModal, confirm }}>
      {children}
      <div className={`toast ${toastOn ? "show" : ""}`} role="status">{toastMsg}</div>
      {modal && (
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label={modal.title}>
            <div className="modal-head">
              <h3>{modal.title}</h3>
              <button className="icon-btn" onClick={closeModal} aria-label="Close"><Icon name="x" /></button>
            </div>
            {modal.body}
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);
